#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  callApi,
  getFirstPage,
  isPageExisting,
  stripCategoryPrefix,
  stripTemplatePrefix,
  ensureCategoryPrefix,
  ensureTemplatePrefix,
  toolResult,
  toolError,
} from "./api.js";

const server = new McpServer({
  name: "tiki-pedia-mcp-server",
  version: "1.0.0",
});

// ─── Page Tools ───

server.tool(
  "tiki_get_page_content",
  "記事のウィキテキスト内容を取得",
  {
    title: z.string().describe("記事のタイトル"),
  },
  async ({ title }) => {
    try {
      const result = await callApi({
        action: "query",
        titles: title,
        prop: "revisions",
        rvprop: "content",
        rvslots: "main",
        format: "json",
      });

      const { pageId, page } = getFirstPage(result);

      if (!isPageExisting(pageId, page)) {
        return toolResult({ title, exists: false, content: null });
      }

      const content = page?.revisions?.[0]?.slots?.main?.["*"];
      return toolResult({ title, exists: true, content: content || "" });
    } catch (error) {
      return toolError(error);
    }
  },
);

server.tool(
  "tiki_check_page_exists",
  "記事の存在確認",
  {
    title: z.string().describe("記事のタイトル"),
  },
  async ({ title }) => {
    try {
      const result = await callApi({
        action: "query",
        titles: title,
        format: "json",
      });

      const { pageId, page } = getFirstPage(result);
      return toolResult({ title, exists: isPageExisting(pageId, page) });
    } catch (error) {
      return toolError(error);
    }
  },
);

// ─── Category Tools ───

server.tool(
  "tiki_get_categories",
  "記事に付与されているカテゴリー一覧を取得",
  {
    title: z.string().describe("記事のタイトル"),
  },
  async ({ title }) => {
    try {
      const result = await callApi({
        action: "query",
        titles: title,
        prop: "categories",
        format: "json",
        cllimit: "max",
      });

      const { page } = getFirstPage(result);
      const categories =
        page?.categories?.map((cat) => stripCategoryPrefix(cat.title)) || [];

      return toolResult({ title, categories, count: categories.length });
    } catch (error) {
      return toolError(error);
    }
  },
);

server.tool(
  "tiki_check_category_exists",
  "カテゴリーの存在確認",
  {
    category: z
      .string()
      .describe("カテゴリー名（Category:プレフィックスなし）"),
  },
  async ({ category }) => {
    try {
      const categoryTitle = ensureCategoryPrefix(category);

      const result = await callApi({
        action: "query",
        titles: categoryTitle,
        format: "json",
      });

      const { pageId, page } = getFirstPage(result);
      return toolResult({
        category,
        categoryTitle,
        exists: isPageExisting(pageId, page),
      });
    } catch (error) {
      return toolError(error);
    }
  },
);

server.tool(
  "tiki_search_categories",
  "カテゴリー名の部分一致検索（opensearch使用）",
  {
    query: z.string().describe("検索するカテゴリー名（部分一致）"),
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("取得する結果数（デフォルト: 10）"),
  },
  async ({ query, limit = 10 }) => {
    try {
      const result = await callApi({
        action: "opensearch",
        search: query,
        namespace: 14,
        limit,
        format: "json",
      });

      const arr = result as unknown[];
      const categories = Array.isArray(arr?.[1])
        ? (arr[1] as string[]).map((t) => stripCategoryPrefix(t))
        : [];

      return toolResult({ query, categories, count: categories.length });
    } catch (error) {
      return toolError(error);
    }
  },
);

server.tool(
  "tiki_search_categories_prefix",
  "カテゴリー名のプレフィックス検索（前方一致）",
  {
    prefix: z.string().describe("カテゴリー名のプレフィックス（前方一致）"),
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("取得する結果数（デフォルト: 50）"),
  },
  async ({ prefix, limit = 50 }) => {
    try {
      const result = await callApi({
        action: "query",
        list: "allcategories",
        acprefix: prefix,
        aclimit: limit,
        format: "json",
      });

      const r = result as {
        query?: { allcategories?: Array<{ "*": string }> };
      };
      const allcategories = r?.query?.allcategories;
      if (!allcategories) throw new Error("API response is invalid");

      const categories = allcategories.map((cat) => cat["*"]);
      return toolResult({ prefix, categories, count: categories.length });
    } catch (error) {
      return toolError(error);
    }
  },
);

server.tool(
  "tiki_list_categories_range",
  "範囲指定でのカテゴリー一覧取得",
  {
    from: z
      .string()
      .optional()
      .describe("開始カテゴリー名（アルファベット順）"),
    to: z.string().optional().describe("終了カテゴリー名（アルファベット順）"),
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("取得する結果数（デフォルト: 50）"),
  },
  async ({ from, to, limit = 50 }) => {
    try {
      const params: Record<string, string | number | boolean> = {
        action: "query",
        list: "allcategories",
        aclimit: limit,
        format: "json",
      };
      if (from) params.acfrom = from;
      if (to) params.acto = to;

      const result = await callApi(params);

      const r = result as {
        query?: { allcategories?: Array<{ "*": string }> };
      };
      const allcategories = r?.query?.allcategories;
      if (!allcategories) throw new Error("API response is invalid");

      const categories = allcategories.map((cat) => cat["*"]);
      return toolResult({
        from: from || "beginning",
        to: to || "end",
        categories,
        count: categories.length,
      });
    } catch (error) {
      return toolError(error);
    }
  },
);

server.tool(
  "tiki_get_category_members",
  "カテゴリーに属するページ一覧を取得",
  {
    category: z
      .string()
      .describe("カテゴリー名（Category:プレフィックスなし）"),
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("取得する結果数（デフォルト: 50）"),
  },
  async ({ category, limit = 50 }) => {
    try {
      const categoryTitle = ensureCategoryPrefix(category);

      const result = await callApi({
        action: "query",
        list: "categorymembers",
        cmtitle: categoryTitle,
        cmlimit: limit,
        format: "json",
      });

      const r = result as {
        query?: { categorymembers?: Array<{ title: string }> };
      };
      const categorymembers = r?.query?.categorymembers;
      if (!categorymembers) throw new Error("API response is invalid");

      const members = categorymembers.map((m) => m.title);
      return toolResult({
        category,
        categoryTitle,
        members,
        count: members.length,
      });
    } catch (error) {
      return toolError(error);
    }
  },
);

// ─── Template Tools ───

server.tool(
  "tiki_get_templates",
  "記事内で使用されているテンプレート一覧を取得",
  {
    title: z.string().describe("記事のタイトル"),
  },
  async ({ title }) => {
    try {
      const result = await callApi({
        action: "query",
        titles: title,
        prop: "templates",
        format: "json",
        tllimit: "max",
      });

      const { page } = getFirstPage(result);
      const templates =
        page?.templates?.map((tpl) => stripTemplatePrefix(tpl.title)) || [];

      return toolResult({ title, templates, count: templates.length });
    } catch (error) {
      return toolError(error);
    }
  },
);

server.tool(
  "tiki_check_template_exists",
  "テンプレートの存在確認",
  {
    template: z
      .string()
      .describe("テンプレート名（Template:プレフィックスなし）"),
  },
  async ({ template }) => {
    try {
      const templateTitle = ensureTemplatePrefix(template);

      const result = await callApi({
        action: "query",
        titles: templateTitle,
        format: "json",
      });

      const { pageId, page } = getFirstPage(result);
      return toolResult({
        template,
        templateTitle,
        exists: isPageExisting(pageId, page),
      });
    } catch (error) {
      return toolError(error);
    }
  },
);

server.tool(
  "tiki_get_template_content",
  "テンプレートのウィキテキスト内容を取得",
  {
    template: z
      .string()
      .describe("テンプレート名（Template:プレフィックスなし）"),
  },
  async ({ template }) => {
    try {
      const templateTitle = ensureTemplatePrefix(template);

      const result = await callApi({
        action: "query",
        titles: templateTitle,
        prop: "revisions",
        rvprop: "content",
        rvslots: "main",
        format: "json",
      });

      const { pageId, page } = getFirstPage(result);

      if (!isPageExisting(pageId, page)) {
        return toolResult({
          template,
          templateTitle,
          exists: false,
          content: null,
        });
      }

      const content = page?.revisions?.[0]?.slots?.main?.["*"];
      return toolResult({
        template,
        templateTitle,
        exists: true,
        content: content || "",
      });
    } catch (error) {
      return toolError(error);
    }
  },
);

server.tool(
  "tiki_search_templates",
  "テンプレート名の部分一致検索（opensearch使用）",
  {
    query: z.string().describe("検索するテンプレート名（部分一致）"),
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("取得する結果数（デフォルト: 10）"),
  },
  async ({ query, limit = 10 }) => {
    try {
      const result = await callApi({
        action: "opensearch",
        search: query,
        namespace: 10,
        limit,
        format: "json",
      });

      const arr = result as unknown[];
      const templates = Array.isArray(arr?.[1])
        ? (arr[1] as string[]).map((t) => stripTemplatePrefix(t))
        : [];

      return toolResult({ query, templates, count: templates.length });
    } catch (error) {
      return toolError(error);
    }
  },
);

server.tool(
  "tiki_search_templates_prefix",
  "テンプレート名のプレフィックス検索（前方一致）",
  {
    prefix: z.string().describe("テンプレート名のプレフィックス（前方一致）"),
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("取得する結果数（デフォルト: 50）"),
  },
  async ({ prefix, limit = 50 }) => {
    try {
      const result = await callApi({
        action: "query",
        list: "allpages",
        apnamespace: 10,
        apprefix: prefix,
        aplimit: limit,
        format: "json",
      });

      const r = result as {
        query?: { allpages?: Array<{ title: string }> };
      };
      const allpages = r?.query?.allpages;
      if (!allpages) throw new Error("API response is invalid");

      const templates = allpages.map((p) => stripTemplatePrefix(p.title));
      return toolResult({ prefix, templates, count: templates.length });
    } catch (error) {
      return toolError(error);
    }
  },
);

server.tool(
  "tiki_list_templates_range",
  "範囲指定でのテンプレート一覧取得",
  {
    from: z
      .string()
      .optional()
      .describe("開始テンプレート名（アルファベット順）"),
    to: z
      .string()
      .optional()
      .describe("終了テンプレート名（アルファベット順）"),
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("取得する結果数（デフォルト: 50）"),
  },
  async ({ from, to, limit = 50 }) => {
    try {
      const params: Record<string, string | number | boolean> = {
        action: "query",
        list: "allpages",
        apnamespace: 10,
        aplimit: limit,
        format: "json",
      };
      if (from) params.apfrom = from;
      if (to) params.apto = to;

      const result = await callApi(params);

      const r = result as {
        query?: { allpages?: Array<{ title: string }> };
      };
      const allpages = r?.query?.allpages;
      if (!allpages) throw new Error("API response is invalid");

      const templates = allpages.map((p) => stripTemplatePrefix(p.title));
      return toolResult({
        from: from || "beginning",
        to: to || "end",
        templates,
        count: templates.length,
      });
    } catch (error) {
      return toolError(error);
    }
  },
);

server.tool(
  "tiki_get_template_usage",
  "テンプレートを使用しているページ一覧を取得（全ページ取得）",
  {
    template: z
      .string()
      .describe("テンプレート名（Template:プレフィックスなし）"),
  },
  async ({ template }) => {
    try {
      const templateTitle = ensureTemplatePrefix(template);

      const allPages: string[] = [];
      let continueParams: Record<string, string> = {};

      while (true) {
        const params: Record<string, string | number | boolean> = {
          action: "query",
          list: "embeddedin",
          eititle: templateTitle,
          format: "json",
          eilimit: "max",
          ...continueParams,
        };

        const result = await callApi(params);
        const r = result as {
          query?: { embeddedin?: Array<{ title: string }> };
          continue?: Record<string, string>;
        };

        const embeddedin = r?.query?.embeddedin;
        if (!embeddedin) throw new Error("API response is invalid");

        for (const page of embeddedin) {
          allPages.push(page.title);
        }

        if (r?.continue) {
          continueParams = r.continue;
        } else {
          break;
        }
      }

      return toolResult({
        template,
        templateTitle,
        pages: allPages,
        count: allPages.length,
      });
    } catch (error) {
      return toolError(error);
    }
  },
);

// ─── Search Tools ───

server.tool(
  "tiki_get_recent_articles",
  "新着記事一覧を取得（recentchanges API使用）",
  {
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("取得する記事数（デフォルト: 50）"),
    namespace: z
      .number()
      .optional()
      .describe(
        "名前空間（デフォルト: 0=メイン記事。14=カテゴリー、10=テンプレートなど）",
      ),
  },
  async ({ limit = 50, namespace = 0 }) => {
    try {
      const result = await callApi({
        action: "query",
        list: "recentchanges",
        rctype: "new",
        rcnamespace: namespace,
        rcprop: "title|timestamp|user|comment|sizes",
        rclimit: limit,
        rcdir: "older",
        format: "json",
      });

      const r = result as {
        query?: {
          recentchanges?: Array<{
            title: string;
            timestamp: string;
            user: string;
            comment?: string;
            newlen: number;
          }>;
        };
      };
      const recentchanges = r?.query?.recentchanges;
      if (!recentchanges) throw new Error("API response is invalid");

      const articles = recentchanges.map((rc) => ({
        title: rc.title,
        timestamp: rc.timestamp,
        user: rc.user,
        comment: rc.comment || "",
        size: rc.newlen,
      }));

      return toolResult({ namespace, articles, count: articles.length });
    } catch (error) {
      return toolError(error);
    }
  },
);

server.tool(
  "tiki_search_fulltext",
  "本文内の文字列を全文検索（MediaWiki Search API使用）",
  {
    query: z.string().describe("検索クエリ（本文内の文字列を検索）"),
    namespace: z
      .number()
      .optional()
      .describe(
        "名前空間（デフォルト: 0=メイン記事。14=カテゴリー、10=テンプレートなど）",
      ),
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("取得する結果数（デフォルト: 50）"),
    offset: z
      .number()
      .min(0)
      .optional()
      .describe("検索結果のオフセット（ページネーション用、デフォルト: 0）"),
  },
  async ({ query, namespace = 0, limit = 50, offset = 0 }) => {
    try {
      const result = await callApi({
        action: "query",
        list: "search",
        srsearch: query,
        srnamespace: namespace,
        srlimit: limit,
        sroffset: offset,
        srprop: "size|wordcount|timestamp|snippet",
        srinfo: "totalhits|suggestion",
        format: "json",
      });

      const r = result as {
        query?: {
          search?: Array<{
            title: string;
            size: number;
            wordcount: number;
            timestamp: string;
            snippet: string;
          }>;
          searchinfo?: {
            totalhits?: number;
            suggestion?: string;
          };
        };
      };
      const search = r?.query?.search;
      const searchinfo = r?.query?.searchinfo;
      if (!search) throw new Error("API response is invalid");

      const results = search.map((item) => ({
        title: item.title,
        size: item.size,
        wordcount: item.wordcount,
        timestamp: item.timestamp,
        snippet: item.snippet.replace(/<[^>]*>/g, ""),
      }));

      return toolResult({
        query,
        namespace,
        totalhits: searchinfo?.totalhits || 0,
        suggestion: searchinfo?.suggestion || null,
        offset,
        results,
        count: results.length,
      });
    } catch (error) {
      return toolError(error);
    }
  },
);

server.tool(
  "tiki_search_title",
  "タイトルの部分一致検索（OpenSearch API使用）",
  {
    query: z.string().describe("検索クエリ（タイトルの部分一致検索）"),
    namespace: z
      .number()
      .optional()
      .describe(
        "名前空間（デフォルト: 0=メイン記事。14=カテゴリー、10=テンプレートなど）",
      ),
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("取得する結果数（デフォルト: 50）"),
  },
  async ({ query, namespace = 0, limit = 50 }) => {
    try {
      const result = await callApi({
        action: "opensearch",
        search: query,
        namespace,
        limit,
        format: "json",
      });

      const arr = result as unknown[];
      const titles = Array.isArray(arr?.[1]) ? (arr[1] as string[]) : [];

      return toolResult({
        query,
        namespace,
        results: titles,
        count: titles.length,
      });
    } catch (error) {
      return toolError(error);
    }
  },
);

// ─── Site Info Tools ───

server.tool(
  "tiki_get_extensions",
  "有効化されている拡張機能一覧を取得",
  {},
  async () => {
    try {
      const result = await callApi({
        action: "query",
        meta: "siteinfo",
        siprop: "extensions",
        format: "json",
      });

      const r = result as {
        query?: {
          extensions?: Array<{
            type: string;
            name: string;
            descriptionmsg?: string;
            description?: string;
            author?: string;
            url?: string;
            version?: string;
            "license-name"?: string;
          }>;
        };
      };
      const extensions = r?.query?.extensions;
      if (!extensions) throw new Error("API response is invalid");

      const extensionList = extensions.map((ext) => ({
        name: ext.name,
        type: ext.type,
        version: ext.version || null,
        author: ext.author || null,
        url: ext.url || null,
        description: ext.description || ext.descriptionmsg || null,
        license: ext["license-name"] || null,
      }));

      const byType: Record<string, string[]> = {};
      for (const ext of extensionList) {
        if (!byType[ext.type]) byType[ext.type] = [];
        byType[ext.type].push(ext.name);
      }

      return toolResult({
        totalCount: extensionList.length,
        byType,
        extensions: extensionList,
      });
    } catch (error) {
      return toolError(error);
    }
  },
);

server.tool(
  "tiki_get_siteinfo",
  "サイト基本情報を取得",
  {
    props: z
      .array(
        z.enum([
          "general",
          "namespaces",
          "namespacealiases",
          "statistics",
          "interwikimap",
          "languages",
          "magicwords",
          "fileextensions",
          "rightsinfo",
          "restrictions",
          "skins",
          "extensiontags",
          "functionhooks",
          "variables",
        ]),
      )
      .optional()
      .describe(
        "取得するサイト情報のプロパティ（デフォルト: general, statistics）",
      ),
  },
  async ({ props = ["general", "statistics"] }) => {
    try {
      const result = await callApi({
        action: "query",
        meta: "siteinfo",
        siprop: props.join("|"),
        format: "json",
      });

      const r = result as { query?: Record<string, unknown> };
      const siteinfo = r?.query;
      if (!siteinfo) throw new Error("API response is invalid");

      return toolResult(siteinfo);
    } catch (error) {
      return toolError(error);
    }
  },
);

// ─── Start Server ───

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error("Tiki-pedia MCP server running via stdio");
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Server error:", error);
  process.exit(1);
});
