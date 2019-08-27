'use strict';

const OWN_NAME = chrome.runtime.getManifest().name;
const {info} = chrome.extension.getBackgroundPage();

Object.assign(document, {
  title: OWN_NAME,
  onkeydown({code, altKey: a, shiftKey: s, ctrlKey: c, metaKey: m}) {
    if (code === 'Escape' && !a && !s && !c && !m ||
        code === 'KeyW' && !a && !s && (c || m))
      close();
  },
});

(async () => {

  // translate
  for (const el of document.querySelectorAll('[tl]'))
    el.firstChild.nodeValue = tl(el.textContent);

  // collect all elements with id
  const dom = {};
  for (const el of document.querySelectorAll('[id]'))
    dom[el.id] = el;

  // show the initially present info
  const {
    src,
    alt,
    title,
    width: w,
    height: h,
    dispWidth: dw,
    dispHeight: dh,
    imagePadding,
    urlWidthCut,
  } = info;
  dom.alt.textContent = [alt, title].filter(Boolean).join(' / ');
  Object.assign(dom.url, {
    href: src,
    title: src,
    textContent: src,
    style: `--cut:${urlWidthCut}px`,
  });
  Object.assign(dom.image, {
    src: src,
    style: `--padding:${imagePadding}px`,
    onload() {
      chrome.windows.getCurrent(w => {
        const td = document.getElementsByTagName('td')[0];
        const {paddingLeft: tdL, paddingRight: tdR} = getComputedStyle(td);
        const urlWidthCut = td.clientWidth + parseFloat(tdL) + parseFloat(tdR) | 0;
        if (urlWidthCut !== info.urlWidthCut)
          dom.url.style.setProperty('--cut', urlWidthCut + 'px');
        chrome.storage.local.set({
          windowExtrasHeight: w.height - window.innerHeight | 0,
          legendHeight: dom.image.getBoundingClientRect().top | 0,
          urlWidthCut,
        });
      });
    },
    onerror() {
      dom.dimensions.textContent = '';
      dom.image.replaceWith(tl('errorLoading'));
    },
  });
  dom.dimensions.textContent = w && h ? `${w} x ${h} px` : '';
  dom.scaled.textContent = dw && dh && dw !== w && dh !== h ?
    `(${tl('scaledTo')} ${dw} x ${dh} px)` : '';

  // wait for size/type if needed
  if (!info.ready)
    Object.assign(info, await fetchInfo());

  // show the file size
  const {size} = info;
  if (!size) {
    dom.size.textContent = '';
    dom.size.disabled = true;
  } else {
    let unit;
    let n = size;
    for (unit of ['', 'kiB', 'MiB', 'GiB']) {
      if (n < 1024)
        break;
      n /= 1024;
    }
    const bytes = formatNumber(size) + ' ' + tl('bytes');
    if (!unit) {
      dom.size.textContent = bytes;
    } else {
      dom.size.textContent = `${formatNumber(n)} ${unit}`;
      dom.bytes.textContent = `(${bytes})`;
    }
  }

  // show the file type
  let type = info.type;
  type = type.split('/', 2).pop();
  type = type && type.toLowerCase() !== 'html' && type.toUpperCase();
  dom.type.textContent = type || '';
  dom.type.disabled = !type;

  // show the error
  if (info.error) {
    document.title = OWN_NAME + ' ' + tl('errorLoading');
    document.body.classList.add('error');
  }
})();

function fetchInfo() {
  return new Promise(resolve => {
    chrome.runtime.onMessage.addListener(function _(msg) {
      if (msg.src === info.src) {
        chrome.runtime.onMessage.removeListener(_);
        resolve(msg);
      }
    });
  });
}

function formatNumber(n) {
  return Number(n).toLocaleString(undefined, {maximumFractionDigits: 1});
}

function tl(s) {
  return chrome.i18n.getMessage(s);
}
