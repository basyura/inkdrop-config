inkdrop.window.setMinimumSize(400, 400);

console.log(`process ${process.platform}`);

inkdrop.commands.add(document.body, "mycmd:select-active", () => {
  const { queryContext } = inkdrop.store.getState();

  if (queryContext.mode == "book") {
    inkdrop.commands.dispatch(
      document.body,
      "core:note-list-show-notes-in-book",
      {
        bookId: queryContext.bookId,
        status: "active",
      }
    );
  } else {
    inkdrop.commands.dispatch(
      document.body,
      "core:note-list-show-notes-with-status",
      {
        status: "active",
      }
    );
  }
  focusNote();
});

inkdrop.commands.add(document.body, {
  "mycmd:open-next-note": () => {
    openNote("next");
  },
  "mycmd:open-prev-note": () => {
    openNote("prev");
  },
});

inkdrop.commands.add(document.body, {
  "mycmd:noop": () => {},
});

function openNote(mode) {
  inkdrop.commands.dispatch(document.body, `core:open-${mode}-note`);
  focusNote();
}

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

inkdrop.commands.add(document.body, "mycmd:select-index", () => {
  inkdrop.commands.dispatch(
    document.body,
    "core:note-list-show-notes-with-tag",
    {
      tagId: "tag:OhQ8pubQl",
    }
  );
  setTimeout(() => {
    inkdrop.commands.dispatch(document.body, "core:open-note", {
      noteId: "note:gZq7mi40L",
    });
    focusNote();
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
    inkdrop.commands.dispatch(document.body, "core:open-note", {
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
    inkdrop.commands.dispatch(document.body, "core:open-note", { noteId });
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
      inkdrop.commands.dispatch(document.body, "view:toggle-distraction-free");
      header.style.paddingLeft = "70px";
    } else if (notelist != null) {
      inkdrop.commands.dispatch(document.body, "view:toggle-distraction-free");
      inkdrop.commands.dispatch(document.body, "view:toggle-distraction-free");
    }
    return;
  } else {
    header.style.paddingLeft = "0px";
  }

  // toggle to normal header
  inkdrop.commands.dispatch(document.body, "view:toggle-distraction-free");
  restoreHeader();
});

inkdrop.commands.add(document.body, "mycmd:toggle-sidebar", () => {
  inkdrop.commands.dispatch(document.body, "view:toggle-sidebar");

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
  inkdrop.commands.dispatch(document.body, "vim:reset-normal-mode");
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
    inkdrop.commands.dispatch(document.body, "core:find-global");
    if (event.argString)
      inkdrop.commands.dispatch(document.body, "core:search-notes", {
        keyword: event.argString.trim(),
      });
  });
});

inkdrop.commands.add(document.body, "mycmd:select-all-notes", () => {
  const { queryContext } = inkdrop.store.getState();
  if (queryContext.mode == "book") {
    inkdrop.commands.dispatch(
      document.body,
      "core:note-list-show-notes-in-book",
      {
        bookId: queryContext.bookId,
      }
    );
  } else {
    const node = document.querySelector(".sidebar-menu-item-all-notes");
    node.querySelector(".content").click();
  }
});
