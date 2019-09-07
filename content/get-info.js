'use strict';

// using 'var' because let/const would fail on re-injection
var KEY = Symbol.for('info');
var EXTENSION_ID = chrome.runtime.id;
window.dispatchEvent(new Event(EXTENSION_ID));
// cancel if the old script isn't orphaned (weird, but just in case)
!window[KEY] && (() => {
  window.addEventListener(EXTENSION_ID, quitWhenOrphaned);
  window.addEventListener('contextmenu', onMenu, {passive: true});
  chrome.runtime.onMessage.addListener(onMessage);

  function onMenu(event) {
    const el = event.composedPath()[0].closest('img, video, a');
    const img = el && el.tagName === 'A' ? findElementWithin(el, event) : el;
    window[KEY] = img && getInfo(img);
  }

  function getInfo(img) {
    return {
      img,
      src: img.src || img.currentSrc,
      alt: img.alt.trim(),
      title: img.title.trim(),
      duration: img.duration,
      bounds: img.getBoundingClientRect(),
      w: img.naturalWidth || img.videoWidth,
      h: img.naturalHeight || img.videoHeight,
    };
  }

  function findElementWithin(link, {clientY: y, clientX: x}) {
    for (const el of link.querySelectorAll('img, video')) {
      const b = el.getBoundingClientRect();
      if (b.left <= x && b.top <= y &&
          b.right >= x && b.bottom >= y)
        return el;
    }
  }

  function onMessage(msg, sender, sendResponse) {
    if (msg === 'ping')
      sendResponse(window === top ? frames.length : 1);
  }

  function quitWhenOrphaned() {
    try {
      chrome.i18n.getUILanguage();
      window[KEY] = true;
    } catch (e) {
      delete window[KEY];
      window.removeEventListener(EXTENSION_ID, quitWhenOrphaned);
      window.removeEventListener('contextmenu', onMenu);
      chrome.runtime.onMessage.removeListener(onMessage);
      for (const el of document.getElementsByClassName(EXTENSION_ID))
        el.remove();
    }
  }
})();
