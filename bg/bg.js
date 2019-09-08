export {ignoreLastError};

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const {frameId} = info;
  const msg = {
    src: info.srcUrl,
    link: info.linkUrl,
  };
  const pong =
    await ping(tab.id, frameId, msg) ||
    await exec(tab.id, {
      file: '/content/show-info.js',
      runAt: 'document_start',
      matchAboutBlank: true,
      frameId,
    }) &&
    await ping(tab.id, frameId, msg);
  if (pong && pong.src)
    (await import('./bg-xhr.js')).fetchInfo(pong, tab.id, frameId);
});

function ping(tabId, frameId, msg) {
  return new Promise(resolve =>
    chrome.tabs.sendMessage(tabId, msg, {frameId}, data =>
      resolve(ignoreLastError(data))));
}

function exec(...args) {
  return new Promise(resolve =>
    chrome.tabs.executeScript(...args, data =>
      resolve(ignoreLastError(data))));
}

function ignoreLastError(data) {
  return chrome.runtime.lastError ? undefined : data;
}
