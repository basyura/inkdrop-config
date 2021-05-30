inkdrop.window.setMinimumSize(400, 400);

const invoke = (command, param) => {
  inkdrop.commands.dispatch(document.body, command, param);
};

const switchBook = (name) => {
  const nodes = document.querySelectorAll(".sidebar-menu-book-list-item");
  for (let i = 0, max = nodes.length; i < max; i++) {
    const node = nodes[i];
    const txt = node.querySelector(".content").innerText;
    if (txt == name) {
      node.querySelector(".disclosure-label").click();
      return true;
    }
  }
  return false;
};

const showNotesInBook = (bookId, status) => {
  invoke("core:note-list-show-notes-in-book", { bookId, status });
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
}

/*
function focusNote() {
  const editorEle = document.querySelector(".editor");
  if (editorEle != null) {
    const isPreview = editorEle.classList.contains("editor-viewmode-preview");
    if (isPreview) {
      const preview = editorEle.querySelector(".mde-preview");
      preview.focus();
    } else {
      inkdrop.getActiveEditor().cm.focus();
    }
  }
}
*/

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

inkdrop.commands.add(document.body, "mycmd:toggle-distraction-free", () => {
  const sidebar = document.querySelector(".sidebar-layout");
  const notelist = document.querySelector(".note-list-bar-layout");
  const header = document.querySelector(".editor-header-title-input");

  // toggle to min header
  if (sidebar != null || notelist != null) {
    if (sidebar != null) {
      invoke("view:toggle-distraction-free");
      header.style.paddingLeft = "70px";
    } else if (notelist != null) {
      invoke("view:toggle-distraction-free");
      invoke("view:toggle-distraction-free");
    }
    return;
  } else {
    header.style.paddingLeft = "0px";
  }

  // toggle to normal header
  invoke("view:toggle-distraction-free");
  restoreHeader();
});

inkdrop.commands.add(document.body, "mycmd:toggle-sidebar", () => {
  invoke("view:toggle-sidebar");

  const notelist = document.querySelector(".note-list-bar-layout");
  // toggle to normal header
  if (notelist != null) {
    restoreHeader();
  }

  // --pane-min-width
});

function restoreHeader() {
  //  const layout = document.querySelector(".editor-meta-layout");
  //  if (layout != null) {
  //    layout.style.display = "";
  //  }
  //
  //  const input = document.querySelector(".editor-title-input");
  //  if (input != null) {
  //    input.style.paddingLeft = "";
  //  }
  //
  //  const header = document.querySelector(".editor-header-layout");
  //  header.style.minHeight = "40px";
  //  for (const el of Array.from(header.children)) {
  //    el.style.display = "";
  //  }
}

inkdrop.commands.add(document.body, "mycmd:reset-normal-mode", () => {
  invoke("vim:reset-normal-mode");
  const vim = inkdrop.packages.activePackages.vim.mainModule.vim;
  const cm = inkdrop.getActiveEditor().cm;
  vim.exCommandDispatcher.processCommand(cm, "nohlsearch");

  const el = inkdrop.getActiveEditor().cm.getWrapperElement();
  inkdrop.commands.dispatch(el, "core:save-note");
});

inkdrop.commands.add(document.body, "mycmd:escape", () => {
  const el = inkdrop.getActiveEditor().cm.getWrapperElement();
  inkdrop.commands.dispatch(el, "vim:exit-insert-mode");
  // inkdrop.commands.dispatch(el, "core:save-note");
});

inkdrop.onEditorLoad(() => {
  var CodeMirror = require("codemirror");
  CodeMirror.Vim.defineEx("find", "f", (_, event) => {
    invoke("core:find-global");
    if (event.argString)
      invoke("core:search-notes", { keyword: event.argString.trim() });
  });
});

inkdrop.onEditorLoad(() => {
  const ele = document.querySelector(".editor-header-title-input input");
  const observer = new MutationObserver((_) => inkdrop.window.setTitle(""));
  observer.observe(ele, {
    attributes: true,
  });
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

inkdrop.commands.add(document.body, "mycmd:switch-main", () => {
  if (switchBook("main")) {
    const { sidebar } = inkdrop.store.getState();
    showNotesInBook(sidebar.workspace.bookId, "active");
    setTimeout(() => invoke("editor:focus"), 700);
  }
});
