export {fetchInfo};
import {ignoreLastError} from './bg.js';

async function fetchInfo(src, tabId, frameId) {
  if (!chrome.webRequest)
    await enableWebRequest();
  const spoofer = chrome.webRequest && spoofReferer(src);
  const xhr = new XMLHttpRequest();
  try {
    xhr.open('HEAD', /^https?:\/\//.test(src) ? src : '///throw');
  } catch (e) {
    return;
  }
  xhr.timeout = 10e3;
  xhr.ontimeout = xhr.onerror = xhr.onreadystatechange = e => {
    const info = {};
    if (xhr.status >= 300 || e.type === 'timeout' || e.type === 'error') {
      info.error = true;
    } else if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
      info.size = xhr.getResponseHeader('Content-Length') | 0;
      info.type = xhr.getResponseHeader('Content-Type');
    } else {
      return;
    }
    chrome.tabs.sendMessage(tabId, info, {frameId}, ignoreLastError);
    if (spoofer)
      chrome.webRequest.onBeforeSendHeaders.removeListener(spoofer);
  };
  xhr.send();
}

function spoofReferer(src) {
  const spoofer = ({requestHeaders}) => {
    let ref = requestHeaders.find(h => h.name.toLowerCase() === 'referer');
    if (!ref)
      requestHeaders.push((ref = {name: 'Referer'}));
    ref.value = new URL(src).origin + '/';
    return {requestHeaders};
  };
  const filter = {
    tabId: -1,
    types: ['xmlhttprequest'],
    urls: [src.split('#', 1)[0] + '*'],
  };
  const extras = [
    'requestHeaders',
    'blocking',
    chrome.webRequest.OnBeforeSendHeadersOptions.EXTRA_HEADERS,
  ].filter(Boolean);
  chrome.webRequest.onBeforeSendHeaders.addListener(spoofer, filter, extras);
  return spoofer;
}

function enableWebRequest() {
  return new Promise(resolve =>
    chrome.permissions.request({
      permissions: [
        'webRequest',
        'webRequestBlocking',
      ],
    }, resolve));
}
