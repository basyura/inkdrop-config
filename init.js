const { shell } = window.require("electron");

inkdrop.window.setMinimumSize(400, 400);

/*
 * ウインドウが通常状態の場合、枠(Border)に色を付ける。
 */
if (process.platform == "win32") {
  const border = "solid gray";
  const borderWidth = "2px 3px 3px 2px";
  // check state
  if (inkdrop.window.isNormal()) {
    document.body.style.border = border;
    document.body.style.borderWidth = borderWidth;
  }
  // add event
  inkdrop.window.on("maximize", () => {
    document.body.style.border = "";
    document.body.style.borderWidth = borderWidth;
  });
  inkdrop.window.on("unmaximize", () => {
    document.body.style.border = border;
    document.body.style.borderWidth = borderWidth;
  });
}

/*
 * カーソルを点滅させない
 */
inkdrop.onEditorLoad((_) => {
  const { cm } = inkdrop.getActiveEditor();
  cm.setOption("cursorBlinkRate", 0);
});

/*
 * more の位置を変える
 */
inkdrop.onEditorLoad((_) => {
  const more = document.querySelector(".editor-header-more button");
  more.style.position = "absolute";
  more.style.marginLeft = "-25px";
  more.style.background = "none";
  more.style.border = "none";
  more.style.cursor = "pointer";

  const g = more.querySelector("g");
  g.setAttribute("stroke", "darkgray");

  const tags = document.querySelector(".note-tags-bar-input");
  tags.appendChild(more);
});

/*
 * spellcheck をオフにする
 */
inkdrop.onEditorLoad((_) => {
  const ele = document.querySelector(
    ".editor-header-title-input.ui.input input[type='text']"
  );
  ele.spellcheck = false;
});

/*
 * フォーカスが当たった際に同期する
 */
let lastBlurTime_ = new Date();
inkdrop.window.on("focus", () => {
  const diff = new Date() - lastBlurTime_;
  if (diff > 1000 * 60 * 5) {
    const { cm } = inkdrop.getActiveEditor();
    showConfirm(cm, "sync ...");
    const { ipcRenderer } = require("electron");
    ipcRenderer.send("command", "application:sync-db", {});
  }
});

inkdrop.window.on("blur", () => (lastBlurTime_ = new Date()));

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

const imeoff = () => {
  const { execSync } = require("child_process");
  if (process.platform == "darwin") {
    execSync("/usr/local/bin/im-select com.google.inputmethod.Japanese.Roman");
    return;
  }

  // Send "{vk1Dsc07B}" by converted AutoHotKey exe
  execSync("imeoff.exe");
};

const invoke = (command, param) => {
  inkdrop.commands.dispatch(document.body, command, param);
};

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
  console.log("mycmd:editor-focus");
  inkdrop.commands.dispatch(document.body, "editor:focus");
  imeoff();
  setTimeout(() => {
    // to avoid visual mode
    const vim = inkdrop.packages.activePackages.vim.mainModule.vim;
    const cm = inkdrop.getActiveEditor().cm;
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
  // set search word
});

inkdrop.commands.add(document.body, {
  "mycmd:focus_title": () => {
    const ele = document.querySelector(
      ".editor-header-title-input.ui.input input[type='text']"
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
  setTimeout(() => {
    const vim = inkdrop.packages.activePackages.vim.mainModule.vim;
    const cm = inkdrop.getActiveEditor().cm;
    vim.exCommandDispatcher.processCommand(cm, "nohlsearch");
  }, 100);
}

inkdrop.commands.add(document.body, "mycmd:select-index", () => {
  invoke("core:note-list-show-notes-with-tag", { tagId: "tag:OhQ8pubQl" });
  setTimeout(() => {
    invoke("core:open-note", { noteId: "note:gZq7mi40L" });
    invoke("editor:focus");
  }, 50);
});

inkdrop.commands.add(document.body, "mycmd:open-cursor-link", () => {
  const cm = inkdrop.getActiveEditor().cm;
  const cur = cm.getCursor();
  const token = cm.getTokenAt(cur);
  if (token.type == null) {
    return;
  }
  // http(s)://
  if (token.type == "url") {
    shell.openExternal(token.string);
    return;
  }
  // inkdrop://
  if ((token.type = "string url")) {
    if (token.string.indexOf("inkdrop://") == -1) {
      return;
    }
    invoke("core:open-note", {
      noteId: token.string.replace("inkdrop://", ""),
    });
    return;
  }
});

inkdrop.commands.add(document.body, "mycmd:open-current-line-links", () => {
  const cm = inkdrop.getActiveEditor().cm;
  const cur = cm.getCursor();
  const str = cm.doc.getLine(cur.line);
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

// メッセージ表示 (Vim Plugin から拝借)
function showConfirm(cm, text) {
  if (cm.openNotification) {
    cm.openNotification('<span style="color: red">' + text + "</span>", {
      bottom: true,
      duration: 5000,
    });
  } else {
    alert(text);
  }
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

//----- vim plugin's command -----//
inkdrop.onEditorLoad(() => {
  // delay
  setTimeout(() => initializeVimCommands(), 5000);
});

function initializeVimCommands() {
  var CodeMirror = require("codemirror");
  // vim plugin not loaded
  if (CodeMirror.Vim == null) {
    console.log("vim is null");
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
