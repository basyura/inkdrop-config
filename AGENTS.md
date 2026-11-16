# AGENTS.md

## 回答方法

- 日本語で簡潔かつ丁寧に回答すること。
- Markdown では強調記法を過度に使用しないこと。

## リポジトリの概要

このリポジトリは、Electron 製ノートアプリケーション Inkdrop の
ユーザー設定を管理する。

- `init.js`: Inkdrop 起動時に実行する初期処理
- `styles.css`: Inkdrop 全体に適用するスタイル
- `styles.local.css`: 環境固有の追加スタイル。Git の管理対象外
- `keymap.json`: キー割り当て

通常版 Inkdrop のユーザーデータは次の場所にある。

```text
~/Library/Application Support/inkdrop
```

インストール済みのプラグインは次の場所にある。

```text
~/Library/Application Support/inkdrop/packages
```

アプリケーションとユーザーデータの対応は次のとおり。

- `/Applications/Inkdrop.app`: 通常版
- 通常版は `inkdrop` のユーザーデータを使用する

通常版のユーザーデータにある `init.js`、`styles.css`、`keymap.json` は、
このリポジトリにある同名ファイルへのシンボリックリンクである。
展開先を編集した場合も、リポジトリのファイルが直接変更される。
末尾に `_` が付いたファイルがある場合は別ファイルであるため、
編集前に用途と対応関係を確認すること。

`init.js` は、ユーザースタイルと同じディレクトリの `styles.local.css` が
存在する場合に読み込み、`inkdrop.styles.addStyleSheet` で適用する。
2026-11-16 の確認時点では、ユーザーデータの `styles.local.css` は
このリポジトリの存在しない `styles.local.less` へのシンボリックリンクであり、
リポジトリの `styles.local.css` は読み込まれない状態だった。
利用する場合は、リンク先と反映方法を確認し、修正案の了承を得てから変更すること。

`account`、`encryption-key`、データベース、Cookie などの機密データは、
利用者から依頼されていない限り、読み取り、表示、変更しないこと。

`packages` 配下はプラグイン更新によって上書きされる可能性がある。
原則として調査目的の読み取りに限定し、直接修正する場合は事前に
利用者へ確認すること。

## 起動中の Inkdrop の DOM とスタイルを確認する方法

### 1. DevTools で確認する（優先）

起動中の Inkdrop で `Command+Option+I` を押して DevTools を開く。
Elements または Console で DOM と計算済みスタイルを確認でき、
アプリケーションの再起動やリモートデバッグ接続は不要である。
UI 操作には実行環境で提供されるコンピューター操作ツールを使用すること。

Console で選択中ノートを確認する例：

```js
JSON.stringify(
  [...document.querySelectorAll(
    ".note-list-bar-layout .note-list-item-view.active"
  )].map(element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      className: element.className,
      boxShadow: style.boxShadow,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    };
  })
)
```

ノートの選択状態は `.note-list-item-view.active` で確認する。
`.task-active` はノートのステータスを表すため、選択状態と混同しないこと。
調査が終わったら、調査用に開いた DevTools を閉じること。

### 2. 必要な場合のみリモートデバッグ接続を使用する

Playwright などによる取得が必要な場合は、まず起動状態を確認する。

```sh
pgrep -afil '/Applications/Inkdrop.app/Contents/MacOS/Inkdrop'
```

デバッグ接続が無効な場合は、未保存の編集内容がないことと、
再起動してよいことを利用者へ確認する。
了承後、Inkdrop のメニューから終了し、本体プロセスが終了したことを
確認してから、ローカル限定のリモートデバッグを有効にして起動する。
終了と起動を続けて実行せず、終了完了を確認すること。
通常の終了操作でプロセスが残る場合は、強制終了せず状況を利用者へ伝えること。

```sh
open -a 'Inkdrop' --args \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222
```

起動後、デバッグポートへの接続を確認する。

```sh
curl -sS --max-time 10 http://127.0.0.1:9222/json/list
```

Inkdrop のページ情報と `webSocketDebuggerUrl` が返れば接続できる。
実行環境でローカル通信が制限されている場合は、必要な許可を得て
コマンドを実行すること。

### 3. Playwright で DOM とスタイルを取得する

この環境で確認済みの Node.js と Playwright は ChatGPT.app 配下にある。
実行前にパスが存在することを確認し、Chrome DevTools Protocol 経由で
Inkdrop に接続する。

```sh
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node -e '
import(
  "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/" +
  "node_modules/playwright/index.mjs"
).then(async ({ chromium }) => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const page = browser.contexts()[0].pages()[0];
  const result = await page.locator("div.editor-layout").evaluate(element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      tagName: element.tagName,
      className: element.className,
      childElementCount: element.childElementCount,
      outerHTML: element.outerHTML,
      computedStyle: {
        display: style.display,
        position: style.position,
        color: style.color,
        backgroundColor: style.backgroundColor,
        width: style.width,
        height: style.height,
        margin: style.margin,
        padding: style.padding
      },
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      }
    };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}).catch(error => {
  console.error(error);
  process.exit(1);
});
'
```

対象を変更する場合は、`page.locator("div.editor-layout")` のセレクターを
置き換える。確認する CSS プロパティは `computedStyle` 内へ追加する。

## 接続時の注意

- デバッグアドレスは必ず `127.0.0.1` に限定すること。
- デバッグポートを LAN やインターネットへ公開しないこと。
- DOM の確認は原則として読み取りのみとすること。
- クリック、入力、DOM 変更などを行う場合は、利用者の依頼範囲を確認すること。
- Inkdrop を通常起動し直すとデバッグ接続は無効になる。調査を続ける場合は、
  まず再起動不要の DevTools を使用すること。

## 修正作業

- ファイル編集前に修正案を提示し、利用者の了承を得ること。
  了承済みの範囲内では再確認せず進めること。計画不要の場合も編集前の了承は得ること。
- 利用者から計画不要と指示されていない場合は、修正前に使用する計画ファイルを
  確定すること。指定がない場合は、新規作成するか既存のどのファイルを使うかを確認し、
  了承前に計画ファイルを作成・更新しないこと。
- 新規計画は `docs/plans` 配下に日本語で作成すること。
  `docs/plans` がなく `.plans` がある場合は `.plans` を使用すること。
  ファイル名は `001` からの連番と修正内容を表す名前にすること。
- 計画作成後は Shiba.app で表示し、修正を進めるか確認すること。
- 利用者の指示なしに、展開先のファイルを直接上書きしないこと。
- 修正後は `git diff --check` を実行すること。
- `keymap.json` を修正した場合は JSON の構文を確認すること。
- `styles.css` の保存時には起動中の Inkdrop への自動反映を確認できた。
  スタイル修正後は、まず再読み込みせず DevTools で DOM と計算済みスタイルを確認すること。
  反映されない場合のみ、再読み込みが必要か検討すること。
- 装飾の追加で文字列やアイコンの位置がずれないようにすること。
  レイアウト変更が不要な線の追加には、内側の `box-shadow` などを検討し、
  適用前後で対象行・文字列・アイコンの位置と寸法、特に縦位置が変化しないことを確認すること。
