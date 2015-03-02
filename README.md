### A fork of [View-Image-Info-Chrome](https://github.com/ehaagwlke/View-Image-Info-Chrome) extension

Major changes:
 
* removed google analytics 
* removed the content script so the extension no longer adds any memory/CPU footprint to the tabs unless it's actually used

Minor changes:

* added an automatic dark theme via `prefers-color-scheme`
* rewritten in modern JavaScript syntax
* network request for the info is now a pure HEAD query
* almost all visible text was slightly reworded
* the UI was slightly restyled

![ui](https://i.imgur.com/vedN3yi.png)

### Permissions:

* `contextMenus` - to add the context menu, duh
* `<all_urls>` - required to get the image file size and its content type (JPEG/PNG and so on)

### How to limit the site permissions 

Chrome allows you to easily limit the extension so it can access only a few sites:

1. right-click the extension icon in the toolbar (or browser menu) and click "Manage" - it'll open `chrome://extensions` details page for this extension 
2. click "On specific sites"
3. enter the URL you want to allow
4. to add more sites click "Add a new page"

![limit UI](https://i.imgur.com/F2nqVdL.png)
