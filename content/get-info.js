'use strict';

if (!window.hasOwnProperty(Symbol.for('info'))) {
  const key = Symbol.for('info');
  for (const el of document.getElementsByClassName(chrome.runtime.id))
    el.remove();
  window.addEventListener('contextmenu', function onMenu(e) {
    const el = e.composedPath()[0].closest('img, video, a');
    const img = !el || el.tagName !== 'A' ? el :
      document.elementsFromPoint(e.clientX, e.clientY)
        .find(el => el.tagName === 'IMG' || el.tagName === 'VIDEO');
    try {
      chrome.runtime.connect({name: img && img !== el ? img.tagName : ''});
    } catch (e) {
      delete window[key];
      window.removeEventListener('contextmenu', onMenu);
      return;
    }
    window[key] = img && {
      img,
      src: img.src || img.currentSrc,
      alt: img.alt,
      title: img.title,
      duration: img.duration,
      bounds: img.getBoundingClientRect(),
      w: img.naturalWidth || img.videoWidth,
      h: img.naturalHeight || img.videoHeight,
      dw: img.clientWidth,
      dh: img.clientHeight,
    };
  }, {passive: true});
}
