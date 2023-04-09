inkdrop.window.setMinimumSize(400, 400);

inkdrop.onEditorLoad((_) => {
  const { cm } = inkdrop.getActiveEditor();
  cm.setOption("cursorBlinkRate", 0);
});

inkdrop.onEditorLoad(() => {
  const ele = document.querySelector(".editor-header-title-input input");
  const observer = new MutationObserver((_) => inkdrop.window.setTitle(""));
  observer.observe(ele, {
    attributes: true,
  });
  document.querySelector(".editor-header-top-spacer").style.height = "0px";
});

// 検索テキストボックスで Enter したらエディタにフォーカスして Vim の検索キーワードにセットする
inkdrop.onEditorLoad(() => {
  const ele = document.querySelector(".note-list-search-bar input");
  // 起動時に非表示になっている場合は何もしない (非同期だった場合の考慮が必要)
  if (ele == null) {
    return;
  }
  ele.addEventListener("keydown", (e) => {
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
      const vim = inkdrop.packages.activePackages.vim.mainModule.vim;
      const cm = inkdrop.getActiveEditor().cm;
      vim.exCommandDispatcher.processCommand(cm, "nohlsearch");
      vim.getVimGlobalState().query = new RegExp(ele.value, "i");
      inkdrop.commands.dispatch(document.body, "editor:focus");
    }, 100);
  });
});

const imeoff = () => {
  const { execSync } = require("child_process");
  if (process.platform == "darwin") {
    execSync("/usr/local/bin/im-select com.google.inputmethod.Japanese.Roman");
    return;
  }

  // Send "{vk1Dsc07B}"
  execSync(process.env["USERPROFILE"] + "/Documents/AutoHotkey/imeoff.ahk");
};

const invoke = (command, param) => {
  inkdrop.commands.dispatch(document.body, command, param);
};

const switchBook = (name, status) => {
  const nodes = document.querySelectorAll(".sidebar-menu-book-list-item");
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
      break;
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

inkdrop.commands.add(document.body, "mycmd:editor-focus", () => {
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
  // http(s)://
  if (token.type == "url") {
    open(token.string);
    return;
  }
  // inkdrop://
  if ((token.type = "string url")) {
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
    open(v[1]);
  });
  // inkdrop:// parse
  const idReg = new RegExp(/(inkdrop:\/\/.*?)( |\)|$)/g);
  const matches = [...str.matchAll(idReg)];
  if (matches.length > 0) {
    const noteId = matches[0][1].replace("inkdrop://", "").replace("/", ":");
    invoke("core:open-note", { noteId });
  }
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

inkdrop.commands.add(document.body, "mycmd:reset-font-size", () => {
  inkdrop.config.set("editor.fontSize", 16);
  inkdrop.config.set("preview.fontSize", 16);
});

inkdrop.commands.add(document.body, "mycmd:open-scratch-note", () => {
  invoke("core:open-note", { noteId: "note:ccQ0UOMgs" });
  setTimeout(() => invoke("editor:focus"), 700);
});

inkdrop.commands.add(document.body, "mycmd:open-idea-note", () => {
  invoke("core:open-note", { noteId: "note:cacpQeu6G" });
  setTimeout(() => invoke("editor:focus"), 700);
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

//----- vim plugin's command -----//
inkdrop.onEditorLoad(() => {
  var CodeMirror = require("codemirror");
  // vim plugin not loaded
  if (CodeMirror.Vim == null) {
    return;
  }

  CodeMirror.Vim.defineEx("new", "new", (_, _event) => {
    invoke("core:new-note");
  });

  CodeMirror.Vim.defineEx("find", "f", (_, event) => {
    invoke("core:find-global");
    if (event.argString)
      invoke("core:search-notes", { keyword: event.argString.trim() });
  });
  // 幅を指定してリサイズ
  CodeMirror.Vim.defineEx("width", "wi", (cm, event) => {
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
    const sidebar = document.querySelector(".sidebar-layout");
    const notelist = document.querySelector(".note-list-bar-layout");
    if (sidebar != null || notelist != null) {
      invoke("view:toggle-distraction-free");
    }
    document.querySelector(".editor-header-top-spacer").style.height = "16px";
    document.querySelector(".editor-meta-layout").style.display = "none";

    const height = window.screen.height;
    const width = window.screen.width;
    const info = { x: width - 600, y: 0, width: 600, height };
    inkdrop.window.setBounds(info);
  });
  // 横幅細めでリサイズ - 左
  CodeMirror.Vim.defineEx("lslim", "lsl", () => {
    const sidebar = document.querySelector(".sidebar-layout");
    const notelist = document.querySelector(".note-list-bar-layout");
    if (sidebar != null || notelist != null) {
      invoke("view:toggle-distraction-free");
    }
    document.querySelector(".editor-header-top-spacer").style.height = "16px";
    document.querySelector(".editor-meta-layout").style.display = "none";

    const height = window.screen.height;
    const width = 600;
    const info = { x: 0, y: 0, width, height };
    inkdrop.window.setBounds(info);
  });
  // 横幅半分にリサイズ
  CodeMirror.Vim.defineEx("half", "ha", () => {
    const height = window.screen.height;
    const width = window.screen.width;
    const info = { x: width / 2, y: 0, width: width / 2, height: height };
    inkdrop.window.setBounds(info);
  });
  // 横幅半分にリサイズ - 左
  CodeMirror.Vim.defineEx("lhalf", "lha", () => {
    const height = window.screen.height;
    const width = window.screen.width / 2;
    const info = { x: 0, y: 0, width, height };
    inkdrop.window.setBounds(info);
  });
  // 画面いっぱいにリサイズ (≠ Full Screen)
  CodeMirror.Vim.defineEx("full", "fu", () => {
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
});
