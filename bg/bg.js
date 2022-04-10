import {fetchInfo} from './bg-xhr.js';
import './bg-install.js';

chrome.contextMenus.onClicked.addListener(async ({srcUrl, linkUrl, frameId}, tab) => {
  const CONTENT = '/content/show-info';
  const MSG = {src: srcUrl, link: linkUrl};
  const tabId = tab.id;
  const nop = () => {};
  const exec = () => chrome.scripting.executeScript({
    target: {tabId, frameIds: [frameId]},
    files: [CONTENT + '.js'],
    // injectImmediately: true, // TODO: Chrome 102
  }).catch(nop);
  const getCss = () => fetch(CONTENT + '.css').then(r => r.text());
  const send = msg => chrome.tabs.sendMessage(tabId, msg ?? MSG, {frameId}).catch(nop);
  const {id, src} =
    await send() ||
    await Promise.all([getCss(), exec()])
      .then(([css]) => send({...MSG, css})) ||
    {};
  if (src) send({id, info: await fetchInfo(src)});
});
