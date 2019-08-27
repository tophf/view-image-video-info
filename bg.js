'use strict';

// used to access the data synchronously in the UI page
// eslint-disable-next-line no-var
var info = {};

chrome.contextMenus.create({
  id: '1',
  type: 'normal',
  title: chrome.i18n.getMessage('contextMenu'),
  contexts: ['image'],
  documentUrlPatterns: ['*://*/*', 'file://*/*'],
}, () => chrome.runtime.lastError);

chrome.contextMenus.onClicked.addListener(({srcUrl: src}, tab) => {
  const isBase64 = src.startsWith('data:image/') && src.includes('base64');
  const meta = {src, isBase64};
  isBase64 ? setBase64Meta(meta) : fetchImageMeta(meta);
  chrome.tabs.executeScript(
    tab.id,
    {code: `(${findOriginalImage})(${JSON.stringify(src)})`},
    data => !chrome.runtime.lastError && openUI({...meta, ...data[0]})
  );
});

function findOriginalImage(src) {
  const lastPart = src.split('/').pop();
  for (const el of document.querySelectorAll(`img[src$="${lastPart}"]`)) {
    if (el.src === src) {
      const b = el.getBoundingClientRect();
      const inView = b.width && b.height &&
                     b.bottom > 0 && b.top < window.innerHeight &&
                     b.right > 0 && b.left < window.innerWidth;
      if (inView) {
        return {
          src,
          alt: el.alt,
          title: el.title,
          width: el.naturalWidth,
          height: el.naturalHeight,
          dispWidth: el.width,
          dispHeight: el.height,
          left: b.left + screenX,
          top: b.top + screenY,
        };
      }
    }
  }
}

async function openUI(data) {
  const minWidth = 400;
  const maxWidth = 600;
  const minHeight = 220;
  const maxHeight = 800;
  const imagePadding = 4;
  const {
    windowExtrasHeight = 24,
    legendHeight = 130,
    urlWidthCut = 90,
  } = await readStorage();
  info = data;
  info.urlWidthCut = urlWidthCut;
  info.imagePadding = imagePadding;
  const {width: w = 1, height: h = 1} = info;
  const width = clamp(minWidth, maxWidth, w);
  const imgHeight = (Math.min(w, maxWidth) - 2 * imagePadding) / w * h;
  const height = clamp(minHeight, maxHeight,
    legendHeight + imgHeight + windowExtrasHeight + imagePadding);
  chrome.windows.create({
    width,
    height,
    top: clamp(0, screen.height - height, info.top) | 0,
    left: clamp(0, screen.width - width, info.left) | 0,
    type: 'popup',
    url: 'ui/view.html',
    focused: true,
  });
}

function setBase64Meta(meta) {
  Object.assign(meta, {
    title: 'base64 data',
    type: meta.src.split(/[/;]/, 2).pop().toUpperCase(),
    size: meta.src.split(';').pop().length / 6 * 8 | 0,
    ready: true,
  });
}

function fetchImageMeta(meta) {
  const xhr = new XMLHttpRequest();
  xhr.open('HEAD', meta.src);
  xhr.timeout = 10e3;
  xhr.ontimeout = xhr.onerror = xhr.onreadystatechange = e => {
    if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
      meta.size = xhr.getResponseHeader('Content-Length') | 0;
      meta.type = xhr.getResponseHeader('Content-Type');
    } else if (xhr.status >= 300 || e.type === 'timeout' || e.type === 'error') {
      meta.error = true;
    } else {
      return;
    }
    meta.ready = true;
    chrome.runtime.sendMessage(meta);
    if (meta.src === info.src)
      Object.assign(info, meta);
  };
  xhr.send();
}

function readStorage(key = null) {
  return new Promise(resolve => {
    chrome.storage.local.get(key, resolve);
  });
}

function clamp(min, max, v) {
  v |= 0;
  return v < min ? min : v > max ? max : v;
}
