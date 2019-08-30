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
  }, () => chrome.runtime.lastError);
  chrome.contextMenus.create({
    ...opts,
    id: 'link',
    contexts: ['link'],
    documentUrlPatterns: ['https://imgur.com/*'],
  }, () => chrome.runtime.lastError);
});

chrome.contextMenus.onClicked.addListener(({frameId}, tab) => {
  const opts = {
    frameId,
    matchAboutBlank: true,
    runAt: 'document_start',
  };
  chrome.tabs.executeScript(tab.id, {
    code: 'try { window[Symbol.for("showInfo")](), true } catch (e) {}',
    ...opts,
  }, done => {
    if (!chrome.runtime.lastError && !done[0])
      chrome.tabs.executeScript(tab.id, {file: '/content/show-info.js', ...opts});
  });
});

function contentScriptInit(tabId, frameId) {
  chrome.tabs.executeScript(tabId, {
    file: '/content/get-info.js',
    matchAboutBlank: true,
    runAt: 'document_start',
    ...(frameId >= 0 ? {frameId} : {allFrames: true}),
  }, () => chrome.runtime.lastError);
}
