### A fork of [View-Image-Info-Chrome](https://github.com/ehaagwlke/View-Image-Info-Chrome) extension

<img align="right" src="https://i.imgur.com/cFUhk4B.png" alt="logo">

Major changes:
 
* google analytics is removed
* video info is also shown
* info is shown inside the page instead of a new window
* content script runs only on demand when showing the info

Minor changes:

* added an automatic dark theme via `prefers-color-scheme`
* rewritten in modern JavaScript syntax
* network request for the info is now a pure HEAD query
* almost all visible text was slightly reworded
* the UI was slightly restyled
* the icon was redrawn using a shutter image by [Freepik](https://www.flaticon.com/authors/freepik) as a base

![ui](https://i.imgur.com/tWZGFGE.png)

### Permissions:

* `contextMenus` - to add the context menu, duh
* `<all_urls>` - to get the file size and type of the image

### How to limit the site permissions 

Chrome allows you to easily limit the extension so it can access only a few sites:

1. right-click the extension icon in the toolbar (or browser menu) and click "Manage" - it'll open `chrome://extensions` details page for this extension 
2. click "On specific sites"
3. enter the URL you want to allow
4. to add more sites click "Add a new page"

![limit UI](https://i.imgur.com/F2nqVdL.png)
