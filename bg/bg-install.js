import {contentScriptInit, ignoreLastError} from './bg.js';

chrome.runtime.onInstalled.addListener(() => {
  localStorage.naviTargets = '';
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
    documentUrlPatterns: [
      'https://imgur.com/*',
      'https://www.facebook.com/*',
    ],
  }, ignoreLastError);
});
