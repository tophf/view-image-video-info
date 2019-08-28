'use strict';

if (typeof window.__getInfo !== 'function') {
  for (const el of document.getElementsByClassName(chrome.runtime.id))
    el.remove();
  let info;
  window.__getInfo = src =>
    info && info.src === src && info;
  window.addEventListener('contextmenu', function onMenu(e) {
    const img = e.button === 2 && !e.altKey && e.composedPath()[0].closest('img');
    info = img && {
      img,
      src: img.src,
      bounds: img.getBoundingClientRect(),
      w: img.naturalWidth,
      h: img.naturalHeight,
      dw: img.width,
      dh: img.height,
    };
    if (!chrome.i18n) {
      delete window.__getInfo;
      window.removeEventListener('contextmenu', onMenu);
    }
  }, {passive: true});
}
