'use strict';

chrome.tabs.onActivated.addListener(({tabId}) => {
  contentScriptInit(tabId);
});

chrome.webNavigation.onCommitted.addListener(({tabId, frameId}) => {
  chrome.tabs.get(tabId, tab => {
    if (tab.active)
      contentScriptInit(tabId, frameId);
  });
});

chrome.runtime.onInstalled.addListener(() => {
  contentScriptInit(null);
  const opts = {
    type: 'normal',
    title: chrome.i18n.getMessage('contextMenu'),
  };
  chrome.contextMenus.create({
    ...opts,
    id: 'info',
    contexts: ['image', 'video'],
    documentUrlPatterns: ['*://*/*', 'file://*/*'],
  }, ignoreLastError);
  chrome.contextMenus.create({
    ...opts,
    id: 'link',
    contexts: ['link'],
    documentUrlPatterns: ['https://imgur.com/*'],
  }, ignoreLastError);
});

chrome.contextMenus.onClicked.addListener(({frameId}, tab) => {
  const opts = {
    frameId,
    matchAboutBlank: true,
    runAt: 'document_start',
  };
  const TRY_SHOW_INFO = 'try { window[Symbol.for("showInfo")]() } catch (e) {}';
  chrome.tabs.executeScript(tab.id, {code: TRY_SHOW_INFO, ...opts}, ([src] = []) => {
    if (src) {
      fetchInfo(src, tab.id, frameId);
    } else if (!chrome.runtime.lastError) {
      chrome.tabs.executeScript(tab.id, {file: '/content/show-info.js', ...opts}, ([src2] = []) =>
        src2 && fetchInfo(src2, tab.id, frameId));
    }
  });
});

function contentScriptInit(tabId, frameId) {
  chrome.tabs.executeScript(tabId, {
    file: '/content/get-info.js',
    matchAboutBlank: true,
    runAt: 'document_start',
    ...(frameId >= 0 ? {frameId} : {allFrames: true}),
  }, ignoreLastError);
}

async function fetchInfo(src, tabId, frameId) {
  await new Promise(resolve =>
    chrome.permissions.request({permissions: ['webRequest', 'webRequestBlocking']}, resolve));
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

function ignoreLastError() {
  return chrome.runtime.lastError;
}
