'use strict';

chrome.tabs.onActivated.addListener(({tabId}) => {
  contentScriptInit(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (tab.active && info.status === 'loading')
    contentScriptInit(tabId);
});

chrome.runtime.onConnect.addListener(port => {
  if (port.name) {
    const type = port.name === 'IMG' ? 'Image' : 'Video';
    addContextMenu(type, 'link');
  } else {
    chrome.contextMenus.remove('link');
  }
});

chrome.runtime.onInstalled.addListener(() => {
  contentScriptInit(null);
  for (const type of ['Image', 'Video'])
    addContextMenu(type);
});

chrome.contextMenus.onClicked.addListener(({frameId}, tab) => {
  const opts = {frameId, matchAboutBlank: true, runAt: 'document_start'};
  chrome.tabs.executeScript(tab.id, {code: `(${contentScriptTryShow})()`, ...opts}, r => {
    if (!chrome.runtime.lastError && !r[0])
      chrome.tabs.executeScript(tab.id, {file: '/content/show-info.js', ...opts});
  });
});

function addContextMenu(type, id = type, cb = ignoreLastError) {
  chrome.contextMenus.create({
    id,
    type: 'normal',
    title: chrome.i18n.getMessage('contextMenu' + type),
    contexts: [id.toLowerCase()],
    documentUrlPatterns: ['*://*/*', 'file://*/*'],
  }, cb);
}

function contentScriptInit(tabId) {
  chrome.tabs.executeScript(tabId, {
    file: '/content/get-info.js',
    allFrames: true,
    matchAboutBlank: true,
  }, ignoreLastError);
}

function contentScriptTryShow() {
  const fn = window[Symbol.for('showInfo')];
  return fn && (fn(), true);
}

function ignoreLastError() {
  return chrome.runtime.lastError;
}
