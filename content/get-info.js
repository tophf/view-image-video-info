'use strict';

if (typeof window.__getInfo !== 'function') {
  for (const el of document.getElementsByClassName(chrome.runtime.id))
    el.remove();
  let info;
  window.__getInfo = src =>
    info && info.src === src && info;
  window.addEventListener('contextmenu', function onMenu(e) {
    const img = e.button === 2 && !e.altKey && e.composedPath()[0].closest('img, video');
    info = img && {
      img,
      src: img.src,
      alt: img.alt,
      title: img.title,
      duration: img.duration,
      bounds: img.getBoundingClientRect(),
      w: img.naturalWidth || img.videoWidth,
      h: img.naturalHeight || img.videoHeight,
      dw: img.clientWidth,
      dh: img.clientHeight,
    };
    if (!chrome.i18n) {
      delete window.__getInfo;
      window.removeEventListener('contextmenu', onMenu);
    }
  }, {passive: true});
}
