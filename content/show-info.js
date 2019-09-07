'use strict';

!window[Symbol.for('showInfo')] && (() => {
  let uiStyle;

  window[Symbol.for('showInfo')] = showInfo;
  return showInfo();

  function showInfo() {
    let bgRequest;
    const info = window[Symbol.for('info')];
    if (!info)
      return;

    removeAll(info);
    createUI(info);

    // get size/type
    if (/^data:.*?base64/.test(info.src)) {
      info.type = info.src.split(/[/;]/, 2).pop().toUpperCase();
      info.size = info.src.split(';').pop().length / 6 * 8 | 0;
      renderFileMeta(info);
    } else {
      bgRequest = info.src;
      chrome.runtime.onMessage.addListener(function onMessage(data) {
        chrome.runtime.onMessage.removeListener(onMessage);
        renderFileMeta(Object.assign(info, data));
      });
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
          alt && ['alt', [
            ['div', {id: 'alt', textContent: alt}],
          ]],
          title && ['title', [
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
    const x = clamp(bounds.left, 10, Math.min(innerWidth, maxW) - b.width - 20);
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
    window.addEventListener('hashchange', removeAll);
    chrome.runtime.onConnect.addListener(removeAll);
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
    if (wasShown && !all[0]) {
      window.removeEventListener('hashchange', removeAll);
      chrome.runtime.onConnect.removeListener(removeAll);
      chrome.runtime.connect({name: 'naviStop'});
    }
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
