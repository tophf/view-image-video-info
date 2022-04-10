'use strict';

window.INJECTED !== 1 && (() => {
  window.INJECTED = 1;

  const EXT_ID = chrome.runtime.id;
  /** @type {Map<string,Info>}*/
  const id2info = new Map();
  /** @type {WeakMap<HTMLImageElement,Info>}*/
  const img2info = new WeakMap();
  const xo = new IntersectionObserver(onIntersect, {rootMargin: 0x1F_FFFF + 'px'});
  let uiStyle, uiCss;

  dispatchEvent(new Event(EXT_ID));
  addEventListener(EXT_ID, quitWhenOrphaned);
  chrome.runtime.onMessage.addListener(onMessage);

  function onMessage(msg, sender, sendResponse) {
    if (msg.css)
      uiCss = msg.css;
    if (msg.src || msg.link) {
      const info = find(msg);
      const isRemote = info && start(info);
      const id = isRemote && `${Math.random()}.${performance.now()}`;
      if (id) id2info.set(id, info);
      sendResponse(id ? {id, src: info.src} : {});
      return;
    }
    if (msg.info) {
      const r = id2info.get(msg.id);
      id2info.delete(msg.id);
      if (r) renderFileMeta(Object.assign(msg.info, r));
    }
  }

  /** @param {IntersectionObserverEntry[]} entries */
  function onIntersect(entries) {
    for (const e of entries) {
      if (!e.isIntersecting)
        removeAll({img: e.target});
    }
  }

  function quitWhenOrphaned() {
    try {
      chrome.i18n.getUILanguage();
      return;
    } catch (e) {}
    xo.disconnect();
    for (const el of document.getElementsByClassName(EXT_ID))
      el.remove();
    xo.disconnect();
    removeEventListener(EXT_ID, quitWhenOrphaned);
    chrome.runtime.onMessage.removeListener(onMessage);
  }

  function find({src, link}) {
    const rxLast = /[^/]*\/?$/;
    const tail = src && (src.startsWith('data:') ? src : src.match(rxLast)[0]).slice(-500);
    const linkSel = link && `a[href$="${(
      !link.startsWith(location.origin) ?
        link.slice(link.indexOf('://') + 1) :
        link.match(rxLast)[0]
    ).slice(-500)}"]`;
    const sel = !src ? linkSel :
      `${link ? linkSel : ''} :-webkit-any([src$="${tail}"], [srcset*="${tail}"])`;
    const img = findClickedImage(src || link, sel, document);
    /** @namespace Info */
    return img && {
      img,
      el: null,
      src: img.src || img.currentSrc,
      alt: (img.alt || '').trim(),
      title: (img.title || '').trim(),
      duration: img.duration,
      bounds: img.getBoundingClientRect(),
      w: img.naturalWidth || img.videoWidth,
      h: img.naturalHeight || img.videoHeight,
    };
  }

  function findClickedImage(src, selector, root) {
    for (let el of root.querySelectorAll(selector)) {
      const tag = el.tagName;
      const elSrc = tag === 'A' ? el.href : el.currentSrc || el.src;
      if (src !== elSrc)
        continue;
      if (tag === 'A') {
        for (const img of el.querySelectorAll('img, video'))
          if (isInView(img))
            return img;
        continue;
      }
      if (tag === 'SOURCE')
        el = el.closest('video, picture');
      if (isInView(el))
        return el;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let el; (el = walker.nextNode());)
      if (el.shadowRoot && (el = findClickedImage(src, selector, el.shadowRoot)))
        return el;
  }

  function isInView(el) {
    const b = el.getBoundingClientRect();
    return b.width && b.height &&
           b.right > 0 && b.bottom > 0 &&
           b.top < innerHeight && b.left < innerWidth;
  }

  function start(info) {
    removeAll(info);
    createUI(info);
    // get size/type
    const {src} = info;
    const isData = /^data:.*?base64/.test(src);
    if (isData) {
      info.type = src.split(/[/;]/, 2).pop().toUpperCase();
      info.size = src.split(';').pop().length / 6 * 8 | 0;
      renderFileMeta(info);
    }
    const style = $make('style', ':host {}');
    info.root.append(uiStyle || (uiStyle = $make('style', uiCss)), style);
    document.body.appendChild(info.el);
    info.style = style.sheet.cssRules[0].style;
    adjustUI(info);
    return !isData;
  }

  function createUI(info) {
    const {img, src, w, h, alt, title, bounds: {width: dw, height: dh}} = info;
    const isImage = img.localName === 'img';
    const el = $make('div', {img, className: EXT_ID});
    const root = el.attachShadow({mode: 'closed'});
    root.append(
      $make('main', [
        $make('div', {
          id: 'close',
          textContent: 'x',
          onclick: event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            removeAll({img});
          },
        }),
        $make('table', [
          ['location', [
            ['a', {
              id: 'url',
              href: src,
              title: src,
              textContent: src,
              target: '_blank',
              rel: 'noopener noreferrer',
            }],
          ]],
          ['dimensions', [
            ['b', w && h ? `${w} x ${h} px` : ''],
            ['i', dw && dh && dw !== w && dh !== h ?
              ` (${tl('scaledTo')} ${formatNumber(dw)} x ${formatNumber(dh)} px)` :
              ''],
          ]],
          ['fileType', [
            ['b', {id: 'type'}],
            ['span', ' ' + tl(`type${isImage ? 'Image' : 'Video'}`)],
            ['span', isImage ? '' : `, ${formatDuration(info)}`],
          ]],
          ['fileSize', [
            ['b', {id: 'size'}],
            ['i', {id: 'bytes'}],
          ]],
          alt &&
          ['alt', [
            ['div', {id: 'alt', textContent: alt}],
          ]],
          title &&
          ['title', [
            ['div', {id: 'title', textContent: title}],
          ]],
        ].map(([tlKey, children] = []) =>
          tlKey &&
          $make('tr', [
            $make('td', tl(tlKey)),
            $make('td', children.map(data => $make(...data))),
          ]))
        ),
      ])
    );
    info.el = el;
    info.root = root;
  }

  function renderFileMeta({size, type, root}) {
    // size
    const elSize = root.getElementById('size');
    if (size) {
      let unit;
      let n = size;
      for (unit of ['', 'kiB', 'MiB', 'GiB']) {
        if (n < 1024)
          break;
        n /= 1024;
      }
      const bytes = `${formatNumber(size)} ${tl('bytes')}`;
      if (!unit) {
        size = bytes;
      } else {
        size = `${formatNumber(n)} ${unit}`;
        root.getElementById('bytes').textContent = ` (${bytes})`;
      }
      elSize.textContent = size;
    } else {
      elSize.closest('tr').remove();
    }

    // type
    const elType = root.getElementById('type');
    type = (type || '').split('/', 2).pop().toUpperCase();
    if (type && type !== 'HTML')
      elType.textContent = type;
    else
      elType.closest('tr').remove();
  }

  function adjustUI(info) {
    const {el, img, bounds, style, root} = info;
    // set position
    const r1 = document.scrollingElement.getBoundingClientRect();
    const r2 = document.body.getBoundingClientRect();
    const maxW = Math.max(r1.right, r2.right, innerWidth);
    const maxH = Math.max(r1.bottom, r2.bottom, scrollY + innerHeight);
    const b = el.getBoundingClientRect();
    const x = clamp(bounds.left, 10, Math.min(innerWidth, maxW) - b.width - 40);
    const y = clamp(bounds.bottom, 10, Math.min(innerHeight, maxH) - b.height - 10);
    style.setProperty('left', x + scrollX + 'px', 'important');
    style.setProperty('top', y + scrollY + 'px', 'important');
    // set auto-fadeout
    let fadeOutTimer;
    el.onmouseleave = () => {
      style.setProperty('transition-duration', '5s', 'important');
      style.setProperty('opacity', '0', 'important');
      fadeOutTimer = setTimeout(removeAll, 5e3, {img});
    };
    el.onmouseenter = () => {
      clearTimeout(fadeOutTimer);
      style.setProperty('opacity', 1, 'important');
      style.setProperty('transition-duration', '.15s', 'important');
    };
    if (!el.matches(':hover')) {
      el.onmouseenter();
      fadeOutTimer = setTimeout(el.onmouseleave, 5e3);
    }
    // expand URL width to fill the entire cell
    requestAnimationFrame(() => {
      const elUrl = root.getElementById('url');
      elUrl.style.maxWidth = elUrl.parentNode.offsetWidth + 'px';
    });
    xo.observe(img);
    img2info.set(img, info);
  }

  function removeAll({img} = {}) {
    const wasShown = img2info.size;
    const infos = img ? [img2info.get(img)].filter(Boolean) : img2info.values();
    for (const i of infos) {
      i.el.remove();
      xo.unobserve(i.img);
      img2info.delete(i.img);
    }
    if (wasShown && !img2info.size)
      xo.disconnect();
  }

  function formatNumber(n) {
    return Number(n).toLocaleString(undefined, {maximumFractionDigits: 1});
  }

  function formatDuration({duration}) {
    if (duration < 1)
      return '0:0' + duration.toFixed(2);
    return new Date(0, 0, 0, 0, 0, Math.round(Number(duration)) | 0)
      .toLocaleTimeString(undefined, {hourCycle: 'h24'})
      // strip 00:0 at the beginning but leave one 0 for minutes so it looks like 0:07
      .replace(/^0+:0?/, '');
  }

  function tl(s) {
    return chrome.i18n.getMessage(s);
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function $make(tag, props) {
    const el = document.createElement(tag);
    if (typeof props === 'string')
      props = {textContent: props};
    const hasProps = props && !Array.isArray(props);
    const children = hasProps ? props.children : props;
    if (children)
      el.append(...children.filter(Boolean));
    if (children && hasProps)
      delete props.children;
    if (hasProps)
      Object.assign(el, props);
    return el;
  }
})();
