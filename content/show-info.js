'use strict';

window.dispatchEvent(new Event(chrome.runtime.id));
!chrome.runtime.onMessage.hasListeners() && (() => {

  const registry = new Map();
  let uiStyle, pushStateEventId;

  chrome.runtime.onMessage.addListener(onMessage);
  window.addEventListener(chrome.runtime.id, quitWhenOrphaned);

  function onMessage(msg, sender, sendResponse) {
    if (msg.src || msg.link)
      sendResponse(showInfo(msg) || {});
    if (msg.info) {
      const info = registry.get(msg.id);
      registry.delete(msg.id);
      info && renderFileMeta(Object.assign(info, msg.info));
    }
  }

  function quitWhenOrphaned(event) {
    try {
      chrome.i18n.getUILanguage();
    } catch (e) {
      if (pushStateEventId)
        runInPage(id => {
          if (history.pushState.__eventId === id)
            delete history.pushState;
        }, pushStateEventId);
      removeNavListeners();
      window.removeEventListener(event.type, quitWhenOrphaned);
      chrome.runtime.onMessage.removeListener(onMessage);
      for (const el of document.getElementsByClassName(event.type))
        el.remove();
    }
  }

  function getInfo({src, link}) {
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
    return img && {
      img,
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

  function showInfo(opts) {
    const info = getInfo(opts);
    if (!info)
      return;

    removeAll(info);
    createUI(info);

    // get size/type
    let bgRequest;
    const {src} = info;
    if (/^data:.*?base64/.test(src)) {
      info.type = src.split(/[/;]/, 2).pop().toUpperCase();
      info.size = src.split(';').pop().length / 6 * 8 | 0;
      renderFileMeta(info);
    } else {
      const id = performance.now();
      bgRequest = {id, src};
      registry.set(id, info);
    }

    Promise.resolve(uiStyle || loadStyle()).then(() => {
      let style;
      const root = info.el.shadowRoot;
      if (root.adoptedStyleSheets) {
        style = new CSSStyleSheet();
        style.replaceSync(':host {}');
        root.adoptedStyleSheets = [uiStyle, style];
      } else {
        style = $make('style', ':host {}');
        root.append(uiStyle.cloneNode(true), style);
      }
      document.body.appendChild(info.el);
      info.style = (style.sheet || style).cssRules[0].style;
      adjustUI(info);
    });

    return bgRequest;
  }

  async function loadStyle() {
    const url = chrome.runtime.getURL('/content/show-info.css');
    const css = await (await fetch(url)).text();
    if (document.adoptedStyleSheets) {
      uiStyle = new CSSStyleSheet();
      uiStyle.replaceSync(css);
    } else {
      uiStyle = $make('style', css);
    }
  }

  function createUI(info) {
    const {img, src, w, h, alt, title, bounds: {width: dw, height: dh}} = info;
    const isImage = img.localName === 'img';
    const el = $make('div', {img, className: chrome.runtime.id});
    el.attachShadow({mode: 'open'}).append(
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
  }

  function renderFileMeta({size, type, el}) {
    // size
    const elSize = el.shadowRoot.getElementById('size');
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
        el.shadowRoot.getElementById('bytes').textContent = ` (${bytes})`;
      }
      elSize.textContent = size;
    } else {
      elSize.closest('tr').remove();
    }

    // type
    const elType = el.shadowRoot.getElementById('type');
    type = (type || '').split('/', 2).pop().toUpperCase();
    if (type && type !== 'HTML')
      elType.textContent = type;
    else
      elType.closest('tr').remove();
  }

  function adjustUI({el, img, bounds, style}) {
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
      const elUrl = el.shadowRoot.getElementById('url');
      elUrl.style.maxWidth = elUrl.parentNode.offsetWidth + 'px';
    });

    // detect SPA navigation
    if (!pushStateEventId) {
      pushStateEventId = chrome.runtime.id + '.' + performance.now();
      runInPage(setupNavDetector, pushStateEventId);
    }
    window.addEventListener(pushStateEventId, removeAll);
    window.addEventListener('hashchange', removeAll);
    window.addEventListener('popstate', removeAll);
  }

  function setupNavDetector(eventId) {
    const fn = history.pushState;
    history.pushState = function () {
      window.dispatchEvent(new Event(eventId));
      return fn.apply(this, arguments);
    };
    history.pushState.__eventId = eventId;
  }

  function runInPage(fn, ...args) {
    const el = $make('script', `(${fn})(${JSON.stringify(args).slice(1, -1)})`);
    document.head.appendChild(el);
    el.remove();
  }

  function removeNavListeners() {
    window.removeEventListener('hashchange', removeAll);
    window.removeEventListener('popstate', removeAll);
    window.removeEventListener(pushStateEventId, removeAll);
  }

  function removeAll({img} = {}) {
    const all = document.getElementsByClassName(chrome.runtime.id);
    const wasShown = Boolean(all[0]);
    // since it's a live collection we need to work on a static copy
    for (const el of [...all]) {
      if (!img || el.img === img) {
        el.shadowRoot.adoptedStyleSheets = [];
        el.remove();
      }
    }
    if (wasShown && !all[0])
      removeNavListeners();
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
