export {contentScriptInit, ignoreLastError};
import * as navi from './bg-navi.js';

chrome.contextMenus.onClicked.addListener(async ({frameId}, tab) => {
  const opts = {
    frameId,
    matchAboutBlank: true,
    runAt: 'document_start',
  };
  let r = await exec(tab.id, {code: `(${tryShowInfo})()`, ...opts});
  if (!r)
    return;
  navi.enlist(tab.id, frameId, tab.url);
  if (!r[0])
    r = await exec(tab.id, {file: '/content/show-info.js', ...opts});
  if (r[0])
    (await import('./bg-xhr.js')).fetchInfo(r[0], tab.id, frameId);
});

chrome.tabs.onActivated.addListener(async ({tabId}) => {
  const framesCount = await ping(tabId, 0);
  if (framesCount === 0)
    return;
  if (!framesCount) {
    contentScriptInit(tabId);
    return;
  }
  // ping each frame and run a content script if there's no response
  chrome.webNavigation.getAllFrames({tabId}, async frames => {
    for (const {frameId} of chrome.runtime.lastError ? [] : frames)
      if (frameId && !await ping(tabId, frameId))
        contentScriptInit(tabId, frameId);
  });
});

chrome.webNavigation.onCommitted.addListener(({tabId, frameId}) => {
  navi.retire(tabId, frameId);
  chrome.tabs.get(tabId, tab => {
    if (!chrome.runtime.lastError && tab.active)
      contentScriptInit(tabId, frameId);
  });
});

function ping(tabId, frameId) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, 'ping', {frameId}, data => {
      resolve(!chrome.runtime.lastError && data);
    });
  });
}

function contentScriptInit(tabId, frameId) {
  chrome.tabs.executeScript(tabId, {
    file: '/content/get-info.js',
    matchAboutBlank: true,
    runAt: 'document_start',
    ...(frameId >= 0 ? {frameId} : {allFrames: true}),
  }, ignoreLastError);
}

function tryShowInfo() {
  try {
    return window.showInfo();
  } catch (e) {}
}

function exec(...args) {
  return new Promise(resolve =>
    chrome.tabs.executeScript(...args, data =>
      resolve(!chrome.runtime.lastError && data)));
}

function ignoreLastError() {
  return chrome.runtime.lastError;
}
