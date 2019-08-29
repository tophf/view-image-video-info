'use strict';

typeof window.__showInfo !== 'function' && (() => {
  let uiStyle;

  window.__showInfo = async src => {
    const info = window.__getInfo(src);

    if (!uiStyle)
      await loadStyle();

    const el = info.el = createUI(info);

    const isBase64 = /^data:.*?base64/.test(src);
    (isBase64 ? setBase64Meta : fetchImageMeta)(info)
      .then(renderFileMeta);

    document.body.appendChild(el);
    setupPosition(info);
    setupAutoFadeOut(info);
    el.style.opacity = 1;

    requestAnimationFrame(() => {
      const elUrl = el.shadowRoot.getElementById('url');
      elUrl.style.maxWidth = elUrl.parentNode.offsetWidth + 'px';
    });
  };

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
    const {img, src, w, h, dw, dh, alt, title} = info;
    const isImage = img.localName === 'img';
    const altTitle = [alt, title].filter(Boolean).join(' / ');
    for (const el of document.getElementsByClassName(chrome.runtime.id))
      if (el.img === img)
        el.remove();
    const el = $make('div', {img, className: chrome.runtime.id});
    const root = el.attachShadow({mode: 'open'});
    if (root.adoptedStyleSheets)
      root.adoptedStyleSheets = [uiStyle];
    else
      root.appendChild(uiStyle.cloneNode(true));
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
    return el;
  }

  function setupAutoFadeOut({el}) {
    let fadeOutTimer;
    el.onmouseleave = () => {
      el.style.transitionDuration = '5s';
      el.style.opacity = '0';
      fadeOutTimer = setTimeout(() => el.remove(), 5e3);
    };
    el.onmouseenter = () => {
      clearTimeout(fadeOutTimer);
      el.style.opacity = 1;
      el.style.transitionDuration = '.1s';
    };
    if (!el.matches(':hover'))
      fadeOutTimer = setTimeout(el.onmouseleave, 5e3);
  }

  function setupPosition(info) {
    let bScroll = document.scrollingElement.getBoundingClientRect();
    if (!bScroll.height)
      bScroll = {bottom: scrollY + innerHeight, right: bScroll.right};
    const b = info.el.getBoundingClientRect();
    const x = Math.min(info.bounds.left, Math.min(innerWidth, bScroll.right) - b.width);
    const y = Math.min(info.bounds.bottom, Math.min(innerHeight, bScroll.bottom) - b.height);
    info.el.style.left = x + scrollX + 'px';
    info.el.style.top = y + scrollY + 'px';
  }

  function renderFileMeta(info) {
    let {size, type, el} = info;
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

    const elType = el.shadowRoot.getElementById('type');
    type = (type || '').split('/', 2).pop().toUpperCase();
    if (type && type !== 'HTML')
      elType.textContent = type;
    else
      elType.closest('tr').remove();
  }

  function setBase64Meta(info) {
    Object.assign(info, {
      type: info.src.split(/[/;]/, 2).pop().toUpperCase(),
      size: info.src.split(';').pop().length / 6 * 8 | 0,
      ready: true,
    });
    return {then: cb => cb(info)};
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

  function tl(s) {
    return chrome.i18n.getMessage(s);
  }

  function formatDuration({duration}) {
    return new Date(0, 0, 0, 0, 0, duration | 0)
      .toLocaleTimeString(undefined, {hourCycle: 'h24'})
      // strip 00:0 at the beginning but leave one 0 for minutes so it looks like 0:07
      .replace(/^0+:0?/, '');
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
