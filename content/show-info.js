'use strict';

!window[Symbol.for('showInfo')] && (() => {
  let uiStyle;

  window[Symbol.for('showInfo')] = showInfo;
  showInfo();

  async function showInfo() {
    const info = window[Symbol.for('info')];
    if (!uiStyle)
      await loadStyle();

    // remove old UI
    for (const el of document.getElementsByClassName(chrome.runtime.id))
      if (el.img === info.img)
        el.remove();

    createUI(info);

    // get size/type
    if (/^data:.*?base64/.test(info.src)) {
      info.type = info.src.split(/[/;]/, 2).pop().toUpperCase();
      info.size = info.src.split(';').pop().length / 6 * 8 | 0;
      info.ready = true;
      renderFileMeta(info);
    } else {
      // renders asynchronously *after* the UI is shown
      fetchImageMeta(info).then(renderFileMeta);
    }

    // note: still invisible here
    document.body.appendChild(info.el);

    // now that it's in DOM we can set up a quick access to the :host{} style tweaks
    info.style = (info.style.sheet || info.style).cssRules[0].style;

    adjustUI(info);
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
    const altTitle = [alt, title].filter(Boolean).join(' / ');
    const el = $make('div', {img, className: chrome.runtime.id});
    const root = el.attachShadow({mode: 'open'});
    if (root.adoptedStyleSheets) {
      info.style = new CSSStyleSheet();
      info.style.replaceSync(':host {}');
      root.adoptedStyleSheets = [uiStyle, info.style];
    } else {
      info.style = $make('style', ':host {}');
      root.append(uiStyle.cloneNode(true), info.style);
    }
    root.append(
      $make('main', [
        $make('div', {
          id: 'close',
          textContent: 'x',
          onclick: event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            el.remove();
          },
        }),
        $make('table', [
          $make('tr', [
            $make('td', tl('location')),
            $make('td', [
              $make('a', {
                id: 'url',
                href: src,
                title: src,
                textContent: src,
                target: '_blank',
                rel: 'noopener noreferrer',
              }),
            ]),
          ]),
          $make('tr', [
            $make('td', tl('dimensions')),
            $make('td', [
              $make('b', w && h ? `${w} x ${h} px` : ''),
              $make('i', {
                textContent: dw && dh && dw !== w && dh !== h ?
                  ` (${tl('scaledTo')} ${dw} x ${dh} px)` :
                  '',
              }),
            ]),
          ]),
          $make('tr', [
            $make('td', tl('fileType')),
            $make('td', [
              $make('b', {id: 'type'}),
              $make('span', ' ' + tl(`type${isImage ? 'Image' : 'Video'}`)),
              $make('span', isImage ? '' : `, ${formatDuration(info)}`),
            ]),
          ]),
          $make('tr', [
            $make('td', tl('fileSize')),
            $make('td', [
              $make('b', {id: 'size'}),
              $make('i', {id: 'bytes'}),
            ]),
          ]),
          altTitle && $make('tr', [
            $make('td', tl('alt')),
            $make('td', altTitle),
          ]),
        ]),
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

  function adjustUI({el, bounds, style}) {
    // set position
    let bScroll = document.scrollingElement.getBoundingClientRect();
    if (!bScroll.height)
      bScroll = {bottom: scrollY + innerHeight, right: bScroll.right};
    const b = el.getBoundingClientRect();
    const x = Math.min(bounds.left, Math.min(innerWidth, bScroll.right) - b.width - 40);
    const y = Math.min(bounds.bottom, Math.min(innerHeight, bScroll.bottom) - b.height - 20);
    style.setProperty('left', x + scrollX + 'px', 'important');
    style.setProperty('top', y + scrollY + 'px', 'important');

    // set auto-fadeout
    let fadeOutTimer;
    el.onmouseleave = () => {
      style.setProperty('transition-duration', '5s', 'important');
      style.setProperty('opacity', '0', 'important');
      fadeOutTimer = setTimeout(() => el.remove(), 5e3);
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
  }

  function fetchImageMeta(info) {
    return new Promise(resolve => {
      const xhr = new XMLHttpRequest();
      xhr.open('HEAD', info.src);
      xhr.timeout = 10e3;
      xhr.ontimeout = xhr.onerror = xhr.onreadystatechange = e => {
        if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
          info.size = xhr.getResponseHeader('Content-Length') | 0;
          info.type = xhr.getResponseHeader('Content-Type');
        } else if (xhr.status >= 300 || e.type === 'timeout' || e.type === 'error') {
          info.error = true;
        } else {
          return;
        }
        info.ready = true;
        resolve(info);
      };
      xhr.send();
    });
  }

  function formatNumber(n) {
    return Number(n).toLocaleString(undefined, {maximumFractionDigits: 1});
  }

  function formatDuration({duration}) {
    return new Date(0, 0, 0, 0, 0, duration | 0)
      .toLocaleTimeString(undefined, {hourCycle: 'h24'})
      // strip 00:0 at the beginning but leave one 0 for minutes so it looks like 0:07
      .replace(/^0+:0?/, '');
  }

  function tl(s) {
    return chrome.i18n.getMessage(s);
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
