'use strict';

chrome.tabs.onActivated.addListener(({tabId}) => {
  contentScriptInit(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (tab.active && info.status === 'loading')
    contentScriptInit(tabId);
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

function contentScriptInit(tabId) {
  chrome.tabs.executeScript(tabId, {
    file: '/content/get-info.js',
    allFrames: true,
    matchAboutBlank: true,
  }, () => chrome.runtime.lastError);
}
