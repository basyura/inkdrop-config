# AGENTS.md

## 回答方法

- 日本語で簡潔かつ丁寧に回答すること。
- Markdown では強調記法を過度に使用しないこと。

## リポジトリの概要

このリポジトリは、Electron 製ノートアプリケーション Inkdrop の
ユーザー設定を管理する。

- `init.js`: Inkdrop 起動時に実行する初期処理
- `styles.less`: Inkdrop 全体に適用するスタイル
- `styles.local.less`: 環境固有の追加スタイル
- `keymap.json`: キー割り当て

Inkdrop Canary のユーザーデータは次の場所にある。

```text
~/Library/Application Support/inkdrop-canary
```

展開先にある `init.js_`、`styles.less_`、`keymap.json_` などを
直接編集する前に、このリポジトリとの対応関係を確認すること。

## Inkdrop の DOM を確認する方法

### 1. 起動状態を確認する

```sh
pgrep -afil '/Applications/Inkdrop 2.app/Contents/MacOS/Inkdrop'
```

起動引数に `--remote-debugging-port=9222` がない場合は、Inkdrop を
終了して、ローカル限定のリモートデバッグを有効にして再起動する。
再起動前に、未保存の編集内容がないことを利用者へ確認すること。

```sh
osascript -e 'tell application "Inkdrop 2" to quit'
open -a 'Inkdrop 2' --args \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222
```

### 2. デバッグポートへの接続を確認する

```sh
curl -sS --max-time 10 http://127.0.0.1:9222/json/list
```

Inkdrop のページ情報と `webSocketDebuggerUrl` が返れば接続できる。
実行環境でローカル通信が制限されている場合は、必要な許可を得て
コマンドを実行すること。

### 3. Playwright で DOM を取得する

Codex.app に同梱された Node.js と Playwright を使用できる場合は、
Chrome DevTools Protocol 経由で Inkdrop に接続する。

```sh
/Applications/Codex.app/Contents/Resources/cua_node/bin/node -e '
import(
  "/Applications/Codex.app/Contents/Resources/cua_node/lib/" +
  "node_modules/playwright/index.mjs"
).then(async ({ chromium }) => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const page = browser.contexts()[0].pages()[0];
  const result = await page.locator("div.editor-layout").evaluate(element => ({
    tagName: element.tagName,
    className: element.className,
    childElementCount: element.childElementCount,
    outerHTML: element.outerHTML
  }));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}).catch(error => {
  console.error(error);
  process.exit(1);
});
'
```

対象を変更する場合は、`page.locator("div.editor-layout")` のセレクターを
置き換える。レイアウト確認では `getComputedStyle(element)` と
`element.getBoundingClientRect()` も利用する。

## 接続時の注意

- デバッグアドレスは必ず `127.0.0.1` に限定すること。
- デバッグポートを LAN やインターネットへ公開しないこと。
- DOM の確認は原則として読み取りのみとすること。
- クリック、入力、DOM 変更などを行う場合は、利用者の依頼範囲を確認すること。
- Inkdrop を通常起動し直すとデバッグ接続は無効になる。その場合は上記手順で
  再起動すること。

## 修正作業

- 具体的なファイル編集前に修正案を提示すること。
- 利用者から計画不要と指示されていない場合は、修正前に日本語の計画を
  `docs/plans` 配下へ連番で作成すること。
- 計画作成後は Shiba.app で表示し、修正を進めるか確認すること。
- 利用者の指示なしに、展開先のファイルを直接上書きしないこと。

