const API_URL = "https://tiki.miraheze.org/w/api.php";

export async function callApi(
  params: Record<string, string | number | boolean>,
): Promise<unknown> {
  const url = new URL(API_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, String(value));
  }

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "TikiPediaMCPServer/1.0.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

interface PageData {
  pageid?: number;
  title?: string;
  missing?: string;
  categories?: Array<{ title: string }>;
  templates?: Array<{ title: string }>;
  revisions?: Array<{
    slots?: {
      main?: {
        "*"?: string;
      };
    };
  }>;
}

export function getFirstPage(result: unknown): {
  pageId: string;
  page: PageData;
} {
  const r = result as { query?: { pages?: Record<string, PageData> } };
  const pages = r?.query?.pages;
  if (!pages) throw new Error("API response is invalid");
  const pageId = Object.keys(pages)[0];
  return { pageId, page: pages[pageId] };
}

export function isPageExisting(pageId: string, page: PageData): boolean {
  return pageId !== "-1" && page?.missing === undefined;
}

export function stripCategoryPrefix(title: string): string {
  return title.replace(/^(Category|カテゴリ):/, "");
}

export function stripTemplatePrefix(title: string): string {
  return title.replace(/^(Template|テンプレート):/, "");
}

export function ensureCategoryPrefix(name: string): string {
  if (name.startsWith("Category:") || name.startsWith("カテゴリ:")) return name;
  return `Category:${name}`;
}

export function ensureTemplatePrefix(name: string): string {
  if (name.startsWith("Template:") || name.startsWith("テンプレート:"))
    return name;
  return `Template:${name}`;
}

export function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function toolError(error: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      },
    ],
    isError: true,
  };
}
