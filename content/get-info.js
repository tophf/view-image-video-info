'use strict';

!window.hasOwnProperty(Symbol.for('info')) && (() => {
  const key = Symbol.for('info');
  for (const el of document.getElementsByClassName(chrome.runtime.id))
    el.remove();
  window.addEventListener('contextmenu', onMenu, {passive: true});

  function onMenu(e) {
    if (!quitWhenOrphaned()) {
      const el = e.composedPath()[0].closest('img, video, a');
      const img = !el || el.tagName !== 'A' ? el :
        [...el.querySelectorAll('img, video')].find(hitTest, e);
      setInfo(img);
    }
  }

  function setInfo(img) {
    window[key] = img && {
      img,
      src: img.src || img.currentSrc,
      alt: img.alt,
      title: img.title,
      duration: img.duration,
      bounds: img.getBoundingClientRect(),
      w: img.naturalWidth || img.videoWidth,
      h: img.naturalHeight || img.videoHeight,
    };
  }

  function hitTest(el) {
    const b = el.getBoundingClientRect();
    return b.left <= this.clientX && b.top <= this.clientY &&
           b.right >= this.clientX && b.bottom >= this.clientY;
  }

  function quitWhenOrphaned() {
    try {
      chrome.i18n.getUILanguage();
    } catch (e) {
      delete window[key];
      window.removeEventListener('contextmenu', onMenu);
      return true;
    }
  }
})();
