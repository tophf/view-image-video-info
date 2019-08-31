export {enlist, retire};

const targets = new Map(
  (localStorage.naviTargets || '')
    .split('\n')
    .filter(Boolean)
    .map(s => s.split('\t')));
if (targets.size)
  observe();

function enlist(tabId, frameId, url) {
  targets.set(tabId + ':' + frameId, new URL(url).origin + '/');
  save();
  observe();
}

function retire(tabId, frameId) {
  if (!targets.size)
    return;
  if (frameId) {
    targets.delete(tabId + ':' + frameId);
  } else {
    // main page is navigated so all frames are destroyed
    const kPrefix = tabId + ':';
    for (const k of targets.keys())
      if (k.startsWith(kPrefix))
        targets.delete(k);
  }
  if (!targets.size)
    stop();
}

function observe() {
  chrome.runtime.onConnect.addListener(onConnect);
  chrome.webNavigation.onHistoryStateUpdated.removeListener(onHistoryStateUpdated);
  chrome.webNavigation.onHistoryStateUpdated.addListener(onHistoryStateUpdated, {
    url: [...new Set(targets.values())].map(urlPrefix => ({urlPrefix})),
  });
}

function stop() {
  chrome.webNavigation.onHistoryStateUpdated.removeListener(onHistoryStateUpdated);
  chrome.runtime.onConnect.removeListener(onConnect);
}

function save() {
  localStorage.naviTargets = [...targets].map(t => t.join('\t')).join('\n');
}

function onHistoryStateUpdated({tabId, frameId}) {
  if (targets.has(tabId + ':' + frameId))
    chrome.tabs.connect(tabId, {frameId, name: 'navigated'});
}

function onConnect(port) {
  if (port.name === 'naviStop') {
    targets.delete(port.sender.tab.id + ':' + port.sender.frameId);
    save();
    if (!targets.size)
      stop();
  }
}
