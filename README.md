### A fork of [View-Image-Info-Chrome](https://github.com/ehaagwlke/View-Image-Info-Chrome) extension

Major changes:
 
* google analytics is removed
* video info is also shown
* info is shown inside the page instead of a new window
* content scripts usage is granular:
  * a small detector script runs only when a tab is focused for the first time
  * the image element is analyzed only when the context menu is invoked
  * the main content script that shows the UI runs only when the extension is invoked from the context menu

Minor changes:

* added an automatic dark theme via `prefers-color-scheme`
* rewritten in modern JavaScript syntax
* network request for the info is now a pure HEAD query
* almost all visible text was slightly reworded
* the UI was slightly restyled

![ui](https://i.imgur.com/tWZGFGE.png)

### Permissions:

* `contextMenus` - to add the context menu, duh
* `<all_urls>` - required to remember the right image before the context menu is invoked (the API doesn't allow to retroactively get the clicked element so unfortunately the extension cannot make do with just `activeTab` permission)

### How to limit the site permissions 

Chrome allows you to easily limit the extension so it can access only a few sites:

1. right-click the extension icon in the toolbar (or browser menu) and click "Manage" - it'll open `chrome://extensions` details page for this extension 
2. click "On specific sites"
3. enter the URL you want to allow
4. to add more sites click "Add a new page"

![limit UI](https://i.imgur.com/F2nqVdL.png)
