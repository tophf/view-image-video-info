let ruleId = 0;

export async function fetchInfo(url) {
  if (!/^https?:\/\//.test(url))
    return;
  const NOP = () => {};
  const RULE = {
    id: ++ruleId,
    condition: {
      domains: [chrome.runtime.id], // TODO: initiatorDomains in Chrome 102
      resourceTypes: ['xmlhttprequest'],
      urlFilter: url,
    },
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{
        header: 'Referer',
        operation: 'set',
        value: new URL(url).origin + '/',
      }],
    },
  };
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE.id],
    addRules: [RULE],
  });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20e3);
  const r = await fetch(url, {method: 'HEAD', signal: ctl.signal}).catch(NOP);
  const info = {};
  if (!r || r.status >= 300) {
    info.error = true;
  } else {
    info.size = r.headers.get('Content-Length') | 0;
    info.type = r.headers.get('Content-Type');
  }
  clearTimeout(timer);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE.id],
  });
  return info;
}
