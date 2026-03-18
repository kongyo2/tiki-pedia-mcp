# @kongyo2/tiki-pedia-mcp-server

[知木ペディア](https://tiki.miraheze.org/)（Miraheze上のMediaWiki）向けMCPサーバーです。

## セットアップ

### Claude Code

```bash
claude mcp add tiki-pedia -- npx @kongyo2/tiki-pedia-mcp-server
```

### Claude Desktop / Cursor 等

`claude_desktop_config.json` に追加:

```json
{
  "mcpServers": {
    "tiki-pedia": {
      "command": "npx",
      "args": ["@kongyo2/tiki-pedia-mcp-server"]
    }
  }
}
```

## ツール一覧

### ページ

| ツール                   | 説明                           |
| ------------------------ | ------------------------------ |
| `tiki_get_page_content`  | 記事のウィキテキスト内容を取得 |
| `tiki_check_page_exists` | 記事の存在確認                 |

### カテゴリ

| ツール                          | 説明                                   |
| ------------------------------- | -------------------------------------- |
| `tiki_get_categories`           | 記事に付与されているカテゴリ一覧を取得 |
| `tiki_check_category_exists`    | カテゴリの存在確認                     |
| `tiki_search_categories`        | カテゴリ名の部分一致検索               |
| `tiki_search_categories_prefix` | カテゴリ名の前方一致検索               |
| `tiki_list_categories_range`    | 範囲指定でのカテゴリ一覧取得           |
| `tiki_get_category_members`     | カテゴリに属するページ一覧を取得       |

### テンプレート

| ツール                         | 説明                                         |
| ------------------------------ | -------------------------------------------- |
| `tiki_get_templates`           | 記事内で使用されているテンプレート一覧を取得 |
| `tiki_check_template_exists`   | テンプレートの存在確認                       |
| `tiki_get_template_content`    | テンプレートのウィキテキスト内容を取得       |
| `tiki_search_templates`        | テンプレート名の部分一致検索                 |
| `tiki_search_templates_prefix` | テンプレート名の前方一致検索                 |
| `tiki_list_templates_range`    | 範囲指定でのテンプレート一覧取得             |
| `tiki_get_template_usage`      | テンプレートを使用しているページ一覧を取得   |

### 検索

| ツール                     | 説明                     |
| -------------------------- | ------------------------ |
| `tiki_get_recent_articles` | 新着記事一覧を取得       |
| `tiki_search_fulltext`     | 本文内の文字列を全文検索 |
| `tiki_search_title`        | タイトルの部分一致検索   |

### サイト情報

| ツール                | 説明                               |
| --------------------- | ---------------------------------- |
| `tiki_get_extensions` | 有効化されている拡張機能一覧を取得 |
| `tiki_get_siteinfo`   | サイト基本情報を取得               |

## 開発

```bash
npm install
npm run build
```

| コマンド            | 説明                       |
| ------------------- | -------------------------- |
| `npm run build`     | TypeScriptコンパイル       |
| `npm run dev`       | 開発モード（ファイル監視） |
| `npm run typecheck` | 型チェック                 |
| `npm run lint`      | oxlintによるリント         |
| `npm run format`    | Prettierによるフォーマット |

## ライセンス

MIT
