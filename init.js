const { shell } = globalThis.require("electron");
const fs = globalThis.require("fs");
const path = globalThis.require("path");

const invoke = (command, param) => {
  inkdrop.commands.dispatch(document.body, command, param);
};

const onEditorLoad = (func) => {
  const editor = inkdrop.activeEditor;
  if (editor != null) {
    func(editor);
  }

  inkdrop.onEditorLoad(func);
};

inkdrop.window.setMinimumSize(400, 400);

// load styles.local.css
{
  const userStylePath = inkdrop.styles.getUserStyleSheetPath();
  const localStylePath = path.join(
    path.dirname(userStylePath),
    "styles.local.css"
  );

  if (fs.existsSync(localStylePath)) {
    const css = fs.readFileSync(localStylePath, "utf8");
    inkdrop.styles.addStyleSheet(css, {
      sourcePath: localStylePath,
      priority: 21,
    });
  }
}

/*
 * ウインドウが通常状態の場合、枠(Border)に色を付ける。
 */
if (process.platform == "win32") {
  const border = "solid gray";
  const borderWidth = "2px 3px 3px 2px";
  // check state
  // if (inkdrop.window.isNormal()) {
  //   document.body.style.border = border;
  //   document.body.style.borderWidth = borderWidth;
  // }
  // // add event
  // inkdrop.window.on("maximize", () => {
  //   document.body.style.border = "";
  //   document.body.style.borderWidth = borderWidth;
  // });
  // inkdrop.window.on("unmaximize", () => {
  //   document.body.style.border = border;
  //   document.body.style.borderWidth = borderWidth;
  // });
}

const imeoff = () => {
  const { execSync } = require("child_process");
  if (process.platform == "darwin") {
    execSync("/usr/local/bin/im-select com.google.inputmethod.Japanese.Roman");
    return;
  }

  // Send "{vk1Dsc07B}" by converted AutoHotKey exe
  execSync("imeoff.exe");
};

function dom(n) {
  if (typeof n === "string") n = document.createElement(n);
  for (var i = 1; i < arguments.length; i++) {
    var a = arguments[i];
    if (!a) continue;
    if (typeof a !== "object") a = document.createTextNode(a);
    if (a.nodeType) n.appendChild(a);
    else
      for (var key in a) {
        if (!Object.prototype.hasOwnProperty.call(a, key)) continue;
        if (key[0] === "$") n.style[key.slice(1)] = a[key];
        else if (typeof a[key] == "function") n[key] = a[key];
        else n.setAttribute(key, a[key]);
      }
  }
  return n;
}
// メッセージ表示 (Vim Plugin から拝借)
function showConfirm(template, duration) {
  if (duration === undefined) {
    duration = 2000;
  }
  const pre = dom(
    "div",
    { $color: "red", $whiteSpace: "pre", class: "cm-vim-message" },
    template
  );
  const { cm } = inkdrop.getActiveEditor();
  if (cm == null) {
    return;
  }
  /*
    if (long) {
      pre = dom(
        "div",
        {},
        pre,
        dom("div", {}, "Press ENTER or type command to continue")
      );
      if (cm.state.closeVimNotification) {
        cm.state.closeVimNotification();
      }
      cm.state.closeVimNotification = cm.openNotification(pre, {
        bottom: true,
        duration: 0,
      });
    } else {
      cm.openNotification(pre, { bottom: true, duration: 15000 });
    }
    */
  cm.openNotification(pre, { bottom: true, duration });
}

// 最大化の解除
function unmaximize() {
  if (inkdrop.window.isMaximized()) {
    inkdrop.window.unmaximize();
  }
}

function isPreviewMode() {
  const ele = document.querySelector(".editor");
  return ele.classList.contains("editor-viewmode-preview");
}

const sync = () => {
  console.log("sync ...");
  showConfirm("sync ...");
  const { ipcRenderer } = require("electron");
  ipcRenderer.send("command", "application:sync-db", {});
};
/*
 * フォーカスが当たった際に同期する
 */
let lastBlurTime_ = new Date();
inkdrop.window.onFocus(() => {
  const diff = new Date() - lastBlurTime_;
  if (diff > 1000 * 60 * 5) {
    sync();
    lastBlurTime_ = new Date();
  }
});

inkdrop.window.onBlur(() => (lastBlurTime_ = new Date()));

// 検索テキストボックスで Enter したらエディタにフォーカスして Vim の検索キーワードにセットする
inkdrop.commands.add(document.body, "mycmd:focus-search", (ev) => {
  const e = ev.originalEvent;
  // 実行トリガーキー
  if (e.key != "Enter") {
    return;
  }

  // 変換確定時は何もしない
  if (e.isComposing) {
    return;
  }

  // ime off
  imeoff();

  // vim の検索ワードにセットする
  setTimeout(() => {
    const ele = document.querySelector(".note-list-search-bar input");
    // preview
    const pf = inkdrop.packages.activePackages["preview-finder"].mainModule;
    pf.find(ele.value);

    // vim
    const vim = inkdrop.packages.activePackages.vim.mainModule.vim;
    const editor = inkdrop.getActiveEditor();
    // 検索ワードがヒットしない場合
    if (editor == null) {
      return;
    }

    const cm = editor.cm;
    vim.exCommandDispatcher.processCommand(cm, "nohlsearch");
    vim.getVimGlobalState().query = new RegExp(ele.value, "i");
    inkdrop.commands.dispatch(document.body, "editor:focus");
  }, 100);
});

const switchBook = (name, status) => {
  const bookEle = document.querySelector(".book-name");
  if (bookEle != null && bookEle.innerText == name) {
    const { sidebar } = inkdrop.store.getState();
    showNotesInBook(sidebar.workspace.bookId, status);
    return;
  }
  const nodes = document.querySelectorAll(".sidebar-menu-book-list-item");
  let isExists = false;
  for (let i = 0, max = nodes.length; i < max; i++) {
    const node = nodes[i];
    const txt = node.querySelector(".content").innerText;
    if (txt == name) {
      node.querySelector(".disclosure-label").click();
      setTimeout(() => {
        const { sidebar } = inkdrop.store.getState();
        showNotesInBook(sidebar.workspace.bookId, status);
      }, 500);
      setTimeout(() => invoke("editor:focus"), 700);
      isExists = true;
      break;
    }
  }

  if (!isExists) {
    const backBtn = document.querySelector(".back-button");
    if (backBtn != null) {
      backBtn.click();
      setTimeout(() => switchBook(name, status), 500);
    }
  }
};

const showNotesInBook = (bookId, status) => {
  invoke("core:note-list-show-notes-in-book", {
    bookId,
    status,
    includeChildren: true,
  });
};

inkdrop.commands.add(document.body, "mycmd:select-active", () => {
  const { sidebar } = inkdrop.store.getState();

  const status = "active";
  const bookId = sidebar.workspace.bookId;
  if (bookId != "") {
    invoke("core:note-list-show-notes-in-book", { bookId, status });
  } else {
    invoke("core:note-list-show-notes-with-status", { status });
  }
  invoke("editor:focus");
});

inkdrop.commands.add(document.body, "mycmd:editor-focus", (ev) => {
  inkdrop.commands.dispatch(document.body, "editor:focus");
  imeoff();
  /*
  setTimeout(() => {
    // to avoid visual mode
    const vim = inkdrop.packages.activePackages.vim.mainModule.vim;
    const editor = inkdrop.getActiveEditor();
    if (editor == null) {
      return;
    }
    const cm = editor.cm;
    vim.exCommandDispatcher.processCommand(cm, "nohlsearch");

    // to set search word
    const input = document.querySelector(
      "#app-container .note-list-bar-layout .note-list-search-bar div input"
    );
    if (input != null && input.value != "") {
      vim.getVimGlobalState().query = new RegExp(input.value, "i");
      inkdrop.commands.dispatch(cm.getWrapperElement(), "vim:repeat-search");
    }
  }, 100);
  */
  // set search word
});

inkdrop.commands.add(document.body, {
  "mycmd:focus_title": () => {
    const ele = document.querySelector(
      ".editor-title-bar-input  input[type='text']"
    );
    ele.focus();
  },
});

inkdrop.commands.add(document.body, {
  "mycmd:open-next-note": () => openNote("next"),
  "mycmd:open-prev-note": () => openNote("prev"),
});

inkdrop.commands.add(document.body, {
  "mycmd:noop": () => {},
});

function openNote(mode) {
  inkdrop.commands.dispatch(document.body, `core:open-${mode}-note`);
  inkdrop.commands.dispatch(document.body, "editor:focus");

  // to avoid visual mode
  // setTimeout(() => {
  //   const vim = inkdrop.packages.activePackages.vim.mainModule.vim;
  //   const cm = inkdrop.getActiveEditor().cm;
  //   vim.exCommandDispatcher.processCommand(cm, "nohlsearch");
  // }, 100);
}

inkdrop.commands.add(document.body, "mycmd:select-index", () => {
  invoke("core:note-list-show-notes-with-tag", { tagId: "tag:OhQ8pubQl" });
  setTimeout(() => {
    invoke("core:open-note", { noteId: "note:gZq7mi40L" });
    invoke("editor:focus");
  }, 50);
});

inkdrop.commands.add(document.body, "mycmd:open-cursor-link", () => {
  console.log("mycmd:open-cursor-link");

  const view = inkdrop.getActiveEditor()?.cm?.cm6;
  if (!view) return;

  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  const offsetInLine = pos - line.from;

  const patterns = [/https?:\/\/[^\s)]+/g, /inkdrop:\/\/[^\s)]+/g];

  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      if (start <= offsetInLine && offsetInLine <= end) {
        const link = m[0];

        if (link.startsWith("http://") || link.startsWith("https://")) {
          shell.openExternal(link);
          return;
        }

        if (link.startsWith("inkdrop://")) {
          const noteId = link.replace("inkdrop://", "").replace("/", ":");
          invoke("core:open-note", { noteId });
          return;
        }
      }
    }
  }
});

inkdrop.commands.add(document.body, "mycmd:open-current-line-links", () => {
  const cm = inkdrop.getActiveEditor().cm.cm6;
  const pos = cm.state.selection.main.head;
  const line = cm.state.doc.lineAt(pos);
  const str = line.text;
  // url parse
  const urlReg = new RegExp(/(http.*?)( |\)|$)/g);
  [...str.matchAll(urlReg)].forEach((v) => {
    //console.log(v);
    shell.openExternal(v[1]);
  });
  // inkdrop:// parse
  const idReg = new RegExp(/(inkdrop:\/\/.*?)( |\)|$)/g);
  const matches = [...str.matchAll(idReg)];
  if (matches.length > 0) {
    const noteId = matches[0][1].replace("inkdrop://", "").replace("/", ":");
    invoke("core:open-note", { noteId });
  }
  // #12345 でチケット番号をパース
  const issueReg = new RegExp(/#(\d+)/g);
  [...str.matchAll(issueReg)].forEach((v) => {
    // config.json に設定を記載
    // "myconfig": {
    //   "redmine_url": "http://redmine.org/issues/"
    // },
    const issueUrl = inkdrop.config.get("myconfig.redmine_url") + v[1];
    shell.openExternal(issueUrl);
  });
});

inkdrop.commands.add(document.body, "mycmd:insertAndSpace", () => {
  //console.log("hi");
  inkdrop.commands.dispatch(document.body, "vim:activate-insert-mode");
  //console.log("ho");
  //inkdrop.commands.dispatch(document.body, "vim:activate-insert-mode")
  //inkdrop.commands.dispatch(document.body, "editor:go-char-left")
});

inkdrop.commands.add(document.body, "mycmd:reset-normal-mode", () => {
  invoke("vim:reset-normal-mode");
  const vim = inkdrop.packages.activePackages.vim.mainModule.vim;
  const cm = inkdrop.getActiveEditor().cm;
  vim.exCommandDispatcher.processCommand(cm, "nohlsearch");

  // const el = inkdrop.getActiveEditor().cm.getWrapperElement();
  // inkdrop.commands.dispatch(el, "core:save-note");
});

inkdrop.commands.add(document.body, "mycmd:find-task", () => {
  const vim = inkdrop.packages.activePackages.vim.mainModule.vim;
  vim.getVimGlobalState().query = /\[ \]/;
  const el = inkdrop.getActiveEditor().cm.getWrapperElement();
  inkdrop.commands.dispatch(el, "vim:repeat-search");
});

inkdrop.commands.add(document.body, "mycmd:escape", () => {
  const el = inkdrop.getActiveEditor().cm.getWrapperElement();
  inkdrop.commands.dispatch(el, "vim:exit-insert-mode");
  // inkdrop.commands.dispatch(el, "core:save-note");
});

inkdrop.commands.add(document.body, "mycmd:select-all-notes", () => {
  const { queryContext } = inkdrop.store.getState();
  if (queryContext.mode == "book") {
    invoke("core:note-list-show-notes-in-book", {
      bookId: queryContext.bookId,
    });
  } else {
    const node = document.querySelector(".sidebar-menu-item-all-notes");
    node.querySelector(".content").click();
  }
});

inkdrop.commands.add(document.body, {
  "mycmd:switch-main": () => switchBook("main", "active"),
  "mycmd:switch-zcrap": () => switchBook("zcrap", "none"),
});

inkdrop.commands.add(document.body, "mycmd:open-scratch-note", () => {
  invoke("core:open-note", { noteId: "note:ccQ0UOMgs" });
  setTimeout(() => invoke("editor:focus"), 700);
});

inkdrop.commands.add(document.body, "mycmd:open-idea-note", () => {
  invoke("core:open-note", { noteId: "note:S4aoc83ZE" });
  setTimeout(() => invoke("editor:focus"), 700);
});

inkdrop.commands.add(document.body, "mycmd:refresh-note", () => {
  const id = inkdrop.activeEditor.props.noteId;
  // 作成済みの blank ページへ
  invoke("core:open-note", { noteId: "note:x0jjUDCo", pushState: false });
  const reopen = () => {
    setTimeout(() => {
      invoke("core:open-note", { noteId: id });
      setTimeout(() => {
        if (id != inkdrop.activeEditor.props.noteId) {
          reopen();
        }
      }, 10);
    }, 10);
  };

  reopen();
});

//----- vim plugin's command -----//
/*
onEditorLoad(() => {
  setTimeout(() => initializeVimCommands(), 3000);
});

function initializeVimCommands() {
  console.log("initializeVimCommands");
  var CodeMirror = require("codemirror");
  // vim plugin not loaded
  if (CodeMirror.Vim == null) {
    console.log("vim is null");
    setTimeout(() => initializeVimCommands(), 3000);
    return false;
  }

  CodeMirror.Vim.defineEx("new", "new", (_, _event) => {
    invoke("core:new-note");
  });

  CodeMirror.Vim.defineEx("find", "f", (_, event) => {
    invoke("core:find-global");
    if (event.argString) {
      invoke("core:search-notes", { keyword: event.argString.trim() });
    }
  });
  // 幅を指定してリサイズ
  CodeMirror.Vim.defineEx("width", "wi", (cm, event) => {
    unmaximize();
    if (event.args == null) {
      showConfirm(cm, "requires an argument.");
      return;
    }
    const height = window.screen.height;
    const width = window.screen.width;
    const arg = parseInt(event.args[0], 10);
    const info = { x: width - arg, y: 0, width: arg, height: height };
    inkdrop.window.setBounds(info);
  });
  // 横幅細めでリサイズ
  CodeMirror.Vim.defineEx("slim", "sl", () => {
    unmaximize();
    const sidebar = document.querySelector(".sidebar-layout");
    const notelist = document.querySelector(".note-list-bar-layout");
    if (sidebar != null || notelist != null) {
      invoke("view:toggle-distraction-free");
    }
    // document.querySelector(".editor-header-top-spacer").style.height = "16px";
    // document.querySelector(".editor-meta-layout").style.display = "none";

    const height = window.screen.height;
    const width = window.screen.width;
    const info = { x: width - 600, y: 0, width: 600, height };
    inkdrop.window.setBounds(info);
  });
  // 横幅細めでリサイズ - 左
  CodeMirror.Vim.defineEx("lslim", "lsl", () => {
    unmaximize();
    const sidebar = document.querySelector(".sidebar-layout");
    const notelist = document.querySelector(".note-list-bar-layout");
    if (sidebar != null || notelist != null) {
      invoke("view:toggle-distraction-free");
    }
    // document.querySelector(".editor-header-top-spacer").style.height = "16px";
    // document.querySelector(".editor-meta-layout").style.display = "none";

    const height = window.screen.height;
    const width = 600;
    const info = { x: 0, y: 0, width, height };
    inkdrop.window.setBounds(info);
  });
  // 横幅半分にリサイズ
  CodeMirror.Vim.defineEx("half", "ha", () => {
    unmaximize();
    const height = window.screen.height;
    const width = window.screen.width;
    const info = { x: width / 2, y: 0, width: width / 2, height: height };
    inkdrop.window.setBounds(info);
  });
  // 横幅半分にリサイズ - 左
  CodeMirror.Vim.defineEx("lhalf", "lha", () => {
    unmaximize();

    const height = window.screen.height;
    const width = window.screen.width / 2;
    const info = { x: 0, y: 0, width, height };
    inkdrop.window.setBounds(info);
  });
  // 最大化
  CodeMirror.Vim.defineEx("max", "max", () => {
    inkdrop.window.maximize();
  });
  // 画面いっぱいにリサイズ (≠ Full Screen)
  CodeMirror.Vim.defineEx("full", "fu", () => {
    unmaximize();
    const height = window.screen.height - 1;
    const width = window.screen.width;
    let info = { x: 0, y: 0, width, height };
    if (process.platform == "win32") {
      info.x = -1;
      info.y = -1;
      info.width += 1;
    }
    inkdrop.window.setBounds(info);
  });

  // テーマ変更
  CodeMirror.Vim.defineEx("theme", "theme", (cm, param) => {
    if (param.args == null || param.args.length == 0) {
      showConfirm(cm, "args : light or dark");
      return;
    }

    const themes = {
      light: ["github-preview", "my-default-light-syntax", "default-light-ui"],
      dark: ["github-preview", "default-dark-ui", "material-dark-mod-syntax"],
    };

    // light: ["github-preview", "default-light-ui", "default-light-syntax"],
    // dark: ["github-preview", "default-dark-ui", "default-dark-syntax"],

    const theme = themes[param.args[0]];
    if (theme == null) {
      showConfirm(cm, "args : light or dark");
      return;
    }

    inkdrop.config.set("core.themes", theme);
  });

  return true;
}
*/

function configureVimKeyBindings() {
  const Vim = inkdrop.packages.getLoadedPackage("vim").mainModule.Vim;
  function noremap(key, cmd) {
    Vim.noremap(key, ":cmd " + cmd + "<CR>");
  }

  noremap("<C-n>", "sidetoc:jump-next");
  noremap("<C-p>", "sidetoc:jump-prev");
  noremap("<C-r>", "narrow-note:open");
  noremap("<C-o>", "core:navigate-back");
  noremap("<C-q>", "core:find");
  noremap("<C-i>", "core:navigate-forward");
  noremap("<C-s>", "core:save-note");
  noremap("<Space>", "view:toggle-preview");
  noremap("e", "hitahint:show");

  noremap("<C-0>", "font-size:reset");
  noremap("<C-;>", "font-size:increase");
  noremap("<C-->", "font-size:decrease");

  noremap("<CR>", "mycmd:open-cursor-link");
  noremap("<C-m>", "mycmd:open-current-line-links");

  noremap("<C-1>", "bearlike-switch-view:toggle-one");
  noremap("<C-2>", "bearlike-switch-view:toggle-two");
  noremap("<C-3>", "bearlike-switch-view:toggle-three");
  noremap("<C-4>", "link-compact:toggle");

  Vim.unmap("<C-x>");
  noremap("<C-x><C-n>", "narrow-book:open");
  noremap("<C-x><C-x>", "mycmd:switch-main");
  noremap("<C-x><C-i>", "mycmd:focus_title");
  noremap("<C-s><C-i>", "mycmd:open-idea-note");

  Vim.map("<C-[>", "* [ ] ", "insert");

  Vim.noremap("j", "gj");
  Vim.noremap("k", "gk");
  Vim.noremap("<C-e>", "$");
  Vim.noremap("U", "<C-r>"); // redo
  Vim.noremap("v", "$h", "visual");
}

// エディタロード時の初期処理
onEditorLoad(() => {
  // spell check off
  const ele = document.querySelector("div.editor-title-bar-input input");
  ele.spellcheck = false;
  // vim
  configureVimKeyBindings();
  // sync
  sync();
});
