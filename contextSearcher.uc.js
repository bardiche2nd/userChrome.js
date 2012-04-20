// ==UserScript==
// @name           contextSearcher.uc.js
// @namespace      http://d.hatena.ne.jp/Griever/
// @description    右クリック→検索の強化
// @include        main
// @compatibility  Firefox 4
// @version        0.0.5mod
// @version        0.0.5
// @note           サブメニューを中クリックすると２回実行される問題を修正
// @note           メニューの検索エンジン名を非表示にした
// @note           カーソル下の単語の取得を調整
// @note           "・"をカタカナとして処理していたのを修正
// @note           0.0.4 アイコンの無い検索エンジンがあるとエラーになるのを修正
// ==/UserScript==
// http://f.hatena.ne.jp/Griever/20100918161044
// ホイールで既定のエンジン変更、サブメニューから他の検索エンジンの利用
// 右クリックの位置により リンクのテキスト、選択文字列、カーソル下の単語を検索可能

//変更点
//カーソル下の単語が, 2回コンテキストメニューを開かないと更新されないバグを修正
//splitmenu -> menu にしたことによりサブメニューからしか検索できないようになった (Context Searchの挙動に準拠)
//それに伴いメニューのラベルの文字を変更

if (window.contextSearcher) {
  window.contextSearcher.destroy();
  delete window.contextSearcher;
}

window.contextSearcher = {
  NEW_TAB: true,

  _regexp: {
    hiragana: "[\\u3040-\\u309F]",
    katakana: "[\\u30A0-\\u30FA\u30FC]",
    kanji   : "[\\u4E00-\\u9FA0]",
    //suuji   : "[0-9_./,%-]",
    eisu_han: "[a-zA-Z0-9_-]",
    eisu_zen: "[\\uFF41-\\uFF5A\\uFF21-\\uFF3A\\uFF10-\\uFF19]",
    hankaku : "[\\uFF00-\\uFFEF]",
  },

  get startReg() {
    let reg = {};
    for(let n in this._regexp) {
      reg[n] = new RegExp('^' + this._regexp[n] + '+');
    }
    delete this.startReg;
    return this.startReg = reg;
  },
  get endReg() {
    let reg = {};
    for(let n in this._regexp) {
      reg[n] = new RegExp(this._regexp[n] + '+$');
    }
    delete this.endReg;
    return this.endReg = reg;
  },
  searchText: '',
  searchEngines: [],
  init: function(){
    this.searchService = Cc["@mozilla.org/browser/search-service;1"].getService(Ci.nsIBrowserSearchService);
    this.context = document.getElementById('contentAreaContextMenu');
    var searchselect = document.getElementById('context-searchselect');
    searchselect.style.display = 'none';

    this.menu = this.context.insertBefore(document.createElement('menu'), searchselect);
    this.menu.setAttribute('id', 'context-searcher');
    this.menu.setAttribute('accesskey', gNavigatorBundle.getString("contextMenuSearchText.accesskey"));
    this.menu.setAttribute('oncommand', 'contextSearcher.command(event);');
    this.menu.setAttribute('onclick', 'if (event.target == this) checkForMiddleClick(this, event);');
    this.menu.setAttribute('iconic', 'true');

    this.popup = this.menu.appendChild( document.createElement('menupopup') );

    // splitmenuのアクセスキーが効かないのでダミーを作る
    this.dummy = this.context.insertBefore(document.createElement('menuitem'), searchselect);
    this.dummy.setAttribute('id', 'context-searcher-dummy');
    this.dummy.setAttribute('command', 'context-searcher');
    this.dummy.setAttribute('accesskey', gNavigatorBundle.getString("contextMenuSearchText.accesskey"));
    this.dummy.collapsed = true;

    this.context.addEventListener('popupshowing', this, false);
    this.menu.addEventListener('DOMMouseScroll', this, false);
	gBrowser.mPanelContainer.addEventListener('click', this, false);
	gBrowser.mPanelContainer.addEventListener('mousedown', this, false);
    window.addEventListener('unload', this, false);

    // サブメニューの表示を遅らせる
    //this.menu._menuDelay = 1000;
  },

  uninit: function() {
    this.context.removeEventListener('popupshowing', this, false);
    this.menu.removeEventListener('DOMMouseScroll', this, false);
	gBrowser.mPanelContainer.removeEventListener('click', this, false);
	gBrowser.mPanelContainer.removeEventListener('mousedown', this, false);
    window.removeEventListener('unload', this, false);
  },

  destroy: function(){
    this.uninit();
    document.getElementById('context-searchselect').style.removeProperty('display');
    var m = document.getElementById('context-searcher');
    if (m)
      m.parentNode.removeChild(m);
    m = document.getElementById('context-searcher-dummy');
    if (m)
      m.parentNode.removeChild(m);
  },

  handleEvent: function(event) {
    if (this[event.type])
      this[event.type](event);
  },
  
  unload: function(e){
    this.uninit();
  },

  DOMMouseScroll: function(e) {
    this.searchEngines = this.searchService.getVisibleEngines({});
    if (!this.searchEngines || this.searchEngines.length == 0)
      return;
    
    var index = this.searchEngines.indexOf(this.searchService.currentEngine);
//    var newEngine = e.detail > 0?
//      this.searchEngines[index+1] || this.searchEngines[0]:
//      this.searchEngines[index-1] || this.searchEngines[this.searchEngines.length -1];
    var newEngine = e.detail > 0? this.searchEngines[index+1] : this.searchEngines[index-1];
    if (!newEngine)
      return;
    this.searchService.currentEngine = newEngine;
    this.setMenuitem();
  },

  command: function(e){
    var target = e.target;
    var engine = e.target.engine || this.menu.engine;

    var submission = engine.getSubmission(this.searchText, null);
    if (!submission)
      return;

    if (!this.NEW_TAB || content.location.href === 'about:blank') {
      loadURI(submission.uri.spec, null, submission.postData, false);
    } else {
      gBrowser.selectedTab = gBrowser.addTab(submission.uri.spec, {
        postData: submission.postData,
        ownerTab: gBrowser.mCurrentTab,
      });
    }
  },

  click: function(event) {
    if (event.button === 2) {
      this._clickNode = event.rangeParent;
      this._clickOffset = event.rangeOffset;
      this._clientX = event.clientX;
    } else {
      this._clickNode = null;
      this._clickOffset = 0;
      this._clientX = 0;
    }
  },
  
  mousedown: function(event){
	  this.click(event);
  },

  setMenuitem: function() {
    var currentEngine = this.searchService.currentEngine;
    var l = this.searchText.length > 16? this.searchText.substr(0, 16) + '...' : this.searchText;
    this.menu.engine = currentEngine;
    //this.menu.setAttribute('label', gNavigatorBundle.getFormattedString("contextMenuSearchText", [currentEngine.name, l]));
    this.menu.setAttribute('label', "\"" + l + "\"\u3092\u691c\u7d22");
//    this.menu.setAttribute('tooltiptext', currentEngine.name);
//    if (currentEngine.iconURI)
//      this.menu.style.listStyleImage = 'url("' + currentEngine.iconURI.spec + '")';
//    else 
//      this.menu.style.removeProperty('list-style-image');
  },

  popupshowing: function(e){
    if (e.target != this.context) return;

	this.searchText = null;
	
    this.searchText = 
      gContextMenu.isTextSelected? this.getBrowserSelection() :
      gContextMenu.onImage? gContextMenu.target.getAttribute('alt') :
      gContextMenu.onLink? gContextMenu.linkText() :
      gContextMenu.onTextInput? this.getTextInputSelection() :
	  this.getCursorPositionText();

    if (!this.searchText || !/\S/.test(this.searchText)) {
      this.menu.hidden = true;
      this.dummy.hidden = true;
      return;
    }
    if (this.searchText.length > 256)
      this.searchText = this.searchText.substr(0, 256);
    this.menu.hidden = false;
    this.dummy.hidden = false;
    
    if (!this.popup.hasChildNodes() || e.ctrlKey)
      this.createMenuitem();
    
    this.setMenuitem();
  },
  
  createMenuitem: function(){
    this.searchEngines = this.searchService.getVisibleEngines({});
    if (!this.searchEngines || this.searchEngines.length == 0)
      return;

    var f;
    while (f = this.popup.firstChild) {
      this.popup.removeChild(f);
    }

    this.menu.engine = this.searchService.currentEngine;
    if (this.menu.engine.iconURI)
      this.menu.style.listStyleImage = 'url("' + this.menu.engine.iconURI.spec + '")';
    else 
      this.menu.style.removeProperty('list-style-image');
    for (var i = 0, s = this.searchEngines, l = s.length; i < l; i++) {
      var engine = s[i];
      var m = document.createElement('menuitem');
      m.setAttribute('label', engine.name);
      if (engine.iconURI) {
        m.setAttribute('image', engine.iconURI.spec);
        m.setAttribute('class', 'menuitem-iconic');
      }
      m.setAttribute('oncommand', 'contextSearcher.command(event);');
      m.setAttribute('onclick', 'checkForMiddleClick(this, event);');
      m.engine = engine;
      this.popup.appendChild(m);
    }
  },
  
  getBrowserSelection: function () {
    var win = document.commandDispatcher.focusedWindow;
    var sel = win.getSelection();
    var str = '';
    if (sel.isCollapsed)
      return str;

    for(var i = 0, l = sel.rangeCount; i < l; i++) {
      str += sel.getRangeAt(i) + ' ';
    }
    return str.replace(/^\s*|\s*$/g, '').replace(/\s+/g, ' ');
  },
  
  getTextInputSelection: function () {
    var elem = document.commandDispatcher.focusedElement;
    var str = elem.value.slice(elem.selectionStart, elem.selectionEnd);
    return str.replace(/^\s*|\s*$/g, '').replace(/\s+/g, ' ');
  },

  getCursorPositionText: function() {
    var node = this._clickNode;
    var offset = this._clickOffset;
    if (!node || node.nodeType !== Node.TEXT_NODE)
      return "";

    // 文字の右半分をクリック時に次の文字を取得する対策
    var text = node.nodeValue;
    var range = node.ownerDocument.createRange();
    range.setStart(node, offset);
    var rect = range.getBoundingClientRect();
    range.detach();
    if (rect.left >= this._clientX)
      offset--;

    var mae = text.substr(0, offset);
    var ato = text.substr(offset); // text[offset] はこっちに含まれる
    var ato_word, type;
    for (let [key, reg] in Iterator(this.startReg)) {
      if (reg.test(ato)) {
        type = key;
        ato_word = RegExp.lastMatch;
        break;
      }
    }
    if (!type) return "";

    var str = this.endReg[type].test(mae) ? RegExp.lastMatch + ato_word : ato_word;

    if (str.length === 1) {
      if (type === "kanji") {
        if (this.startReg["hiragana"].test(ato.substr(ato_word.length)))
          str += RegExp.lastMatch;
      } else {
        return "";
      }
    }
    
    return str;
  },

  log: function() {
	  	if(!this._console){
			this._console = Components.classes["@mozilla.org/consoleservice;1"]
                                 .getService(Components.interfaces.nsIConsoleService);
		}

		this._console.logStringMessage("[contextSearcher] " + Array.slice(arguments));
  }
}

window.contextSearcher.init();
