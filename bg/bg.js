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

chrome.tabs.onActivated.addListener(({tabId}) => {
  contentScriptInit(tabId);
});

chrome.webNavigation.onCommitted.addListener(({tabId, frameId}) => {
  navi.retire(tabId, frameId);
  chrome.tabs.get(tabId, tab => {
    if (!chrome.runtime.lastError && tab.active)
      contentScriptInit(tabId, frameId);
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
