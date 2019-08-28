'use strict';

let srcAsJson;

chrome.tabs.onActivated.addListener(({tabId}) => {
  contentScriptInit(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (tab.active && info.status === 'loading')
    contentScriptInit(tabId);
});

chrome.runtime.onInstalled.addListener(() => {
  contentScriptInit(null);
});

chrome.contextMenus.create({
  id: '1',
  type: 'normal',
  title: chrome.i18n.getMessage('contextMenu'),
  contexts: ['image'],
  documentUrlPatterns: ['*://*/*', 'file://*/*'],
}, ignoreLastError);

chrome.contextMenus.onClicked.addListener(({srcUrl}, tab) => {
  srcAsJson = JSON.stringify(srcUrl);
  chrome.runtime.onMessage.addListener(onMessage);
  chrome.tabs.executeScript(tab.id, {
    code: `(${contentScriptQuery})(${srcAsJson})`,
    allFrames: true,
    matchAboutBlank: true,
  }, (canShow = []) => {
    if (chrome.runtime.lastError || canShow.some(Boolean))
      chrome.runtime.onMessage.removeListener(onMessage);
  });
});

function onMessage(msg, sender) {
  if (msg === 'show') {
    chrome.runtime.onMessage.removeListener(onMessage);
    const tabId = sender.tab.id;
    const opts = {
      frameId: sender.frameId,
      matchAboutBlank: true,
      runAt: 'document_start',
    };
    chrome.tabs.executeScript(tabId, {file: '/content/show-info.js', ...opts}, () =>
      chrome.tabs.executeScript(tabId, {code: `(${contentScriptShow})(${srcAsJson})`, ...opts}));
  }
}

function contentScriptInit(tabId) {
  chrome.tabs.executeScript(tabId, {
    file: '/content/get-info.js',
    allFrames: true,
    matchAboutBlank: true,
  }, ignoreLastError);
}

function contentScriptQuery(src) {
  const img = typeof __getInfo === 'function' && window.__getInfo(src);
  if (img) {
    const canShow = typeof __showInfo === 'function';
    if (canShow)
      window.__showInfo(src);
    else
      chrome.runtime.sendMessage('show');
    return canShow;
  }
}

function contentScriptShow(src) {
  window.__showInfo(src);
}

function ignoreLastError() {
  return chrome.runtime.lastError;
}
