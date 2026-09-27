# StoryCardWriter LITE

StoryCardWriterで保存した `.scw`（JSON形式）を、カードの順序と配置を保ったまま開き、編集して保存するElectronアプリです。従来の `.json` ファイルも開いて保存でき、保存内容のデータ構造は変更しません。

## 起動

```sh
pnpm install
pnpm start
```

## 対応範囲

- 新規、開く、保存、名前を付けて保存
- 主人公、相手役、ナレーション、アクション、心の声、効果音カード
- カード追加、編集、削除、後に追加
- Android版JSONの順序・既知項目・未知の追加項目の保持

共有、ブレーンストーム、SCR階層、ダブルクリックによる別画面は未実装です。

## macOSアプリの作成

Intel Mac向けの署名なしアプリを作成します。

```sh
pnpm build:mac
```

アーキテクチャを明示する場合：

```sh
pnpm build:mac:x64
pnpm build:mac:arm64
```

完成したアプリは次の場所に出力されます。

- Intel: `dist/mac-x64/StoryCardWriter LITE - Intel.app`
- Apple Silicon: `dist/mac-arm64/StoryCardWriter LITE - Apple Silicon.app`
