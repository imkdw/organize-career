/**
 * data/ 원본(JIRA/GitHub/Confluence API 응답)에서 커리어 분석에 유용한 필드만 추출해
 * data-clean/ 에 저장한다. 원본은 수정하지 않는다.
 *
 * 실행: pnpm clean
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const CLEAN_DIR = path.join(ROOT, "data-clean");

// ---------- 공통 유틸 ----------

async function loadJson<T>(relPath: string): Promise<T> {
  const raw = await readFile(path.join(DATA_DIR, relPath), "utf-8");
  return JSON.parse(raw) as T;
}

async function saveJson(relPath: string, data: unknown): Promise<void> {
  const target = path.join(CLEAN_DIR, relPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(data, null, 2), "utf-8");
}

/** Atlassian Document Format(ADF) 트리에서 순수 텍스트만 추출 */
function adfToText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(adfToText).join("");
  if (typeof node === "object") {
    const n = node as Record<string, unknown>;
    if (n.type === "text" && typeof n.text === "string") return n.text;
    if (n.type === "hardBreak") return "\n";
    const inner = adfToText(n.content ?? "");
    // 블록 노드는 줄바꿈으로 구분
    const blockTypes = new Set([
      "paragraph",
      "heading",
      "listItem",
      "codeBlock",
      "blockquote",
      "tableRow",
    ]);
    return blockTypes.has(n.type as string) ? inner + "\n" : inner;
  }
  return "";
}

/** Confluence storage XHTML에서 순수 텍스트만 추출 */
function htmlToText(html: string): string {
  return html
    .replace(/<(?:ac:structured-macro|ac:parameter)[^>]*>/g, " ")
    .replace(/<\/(?:p|li|h[1-6]|tr|div|br)>/g, "\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const cleanText = (s: string): string =>
  s.replace(/\n{3,}/g, "\n\n").trim();

// ---------- JIRA ----------

type Any = Record<string, any>;

function cleanJiraIssue(issue: Any): Any {
  const f = issue.fields ?? {};
  const sprints = Array.isArray(f.customfield_10020)
    ? f.customfield_10020.map((s: Any) => s?.name).filter(Boolean)
    : [];
  const comments = (f.comment?.comments ?? []).map((c: Any) => ({
    author: c.author?.displayName ?? null,
    created: c.created ?? null,
    body: cleanText(adfToText(c.body)),
  }));
  return {
    key: issue.key,
    summary: f.summary ?? null,
    type: f.issuetype?.name ?? null,
    status: f.status?.name ?? null,
    resolution: f.resolution?.name ?? null,
    project: f.project ? { key: f.project.key, name: f.project.name } : null,
    assignee: f.assignee?.displayName ?? null,
    reporter: f.reporter?.displayName ?? null,
    labels: f.labels ?? [],
    components: (f.components ?? []).map((c: Any) => c.name).filter(Boolean),
    fixVersions: (f.fixVersions ?? []).map((v: Any) => v.name).filter(Boolean),
    sprints,
    parent: f.parent?.key ?? null,
    subtasks: (f.subtasks ?? []).map((s: Any) => s.key).filter(Boolean),
    issuelinks: (f.issuelinks ?? [])
      .map((l: Any) => {
        const other = l.outwardIssue ?? l.inwardIssue;
        if (!other) return null;
        const relation = l.outwardIssue ? l.type?.outward : l.type?.inward;
        return { relation: relation ?? l.type?.name ?? null, key: other.key };
      })
      .filter(Boolean),
    created: f.created ?? null,
    updated: f.updated ?? null,
    duedate: f.duedate ?? null,
    resolutiondate: f.resolutiondate ?? null,
    description: f.description ? cleanText(adfToText(f.description)) : null,
    comments,
    attachmentCount: (f.attachment ?? []).length,
  };
}

// ---------- GitHub ----------

function cleanCommit(c: Any): Any {
  return {
    sha: c.sha,
    repo: c.repository?.full_name ?? null,
    message: c.commit?.message ?? null,
    author: c.commit?.author?.name ?? null,
    date: c.commit?.author?.date ?? null,
    url: c.html_url ?? null,
  };
}

function cleanPr(p: Any): Any {
  return {
    number: p.number,
    repo: p.repository_url?.replace("https://api.github.com/repos/", "") ?? null,
    title: p.title ?? null,
    author: p.user?.login ?? null,
    state: p.state ?? null,
    draft: p.draft ?? false,
    labels: (p.labels ?? []).map((l: Any) => l.name).filter(Boolean),
    createdAt: p.created_at ?? null,
    closedAt: p.closed_at ?? null,
    mergedAt: p.pull_request?.merged_at ?? null,
    commentCount: p.comments ?? 0,
    body: p.body ? cleanText(p.body) : null,
    url: p.html_url ?? null,
  };
}

// ---------- Confluence ----------

function cleanPage(pg: Any): Any {
  return {
    id: pg.id,
    title: pg.title ?? null,
    space: pg.space ? { key: pg.space.key, name: pg.space.name } : null,
    createdBy: pg.history?.createdBy?.displayName ?? null,
    createdDate: pg.history?.createdDate ?? null,
    lastUpdatedBy: pg.version?.by?.displayName ?? null,
    lastUpdatedDate: pg.version?.when ?? null,
    version: pg.version?.number ?? null,
    body: pg.body?.storage?.value ? htmlToText(pg.body.storage.value) : null,
  };
}

// ---------- 실행 ----------

async function main(): Promise<void> {
  const jobs: Array<[string, (item: Any) => Any]> = [
    ["jira/issues.json", cleanJiraIssue],
    ["github/commits.json", cleanCommit],
    ["github/pull-requests.json", cleanPr],
    ["github/reviewed-prs.json", cleanPr],
    ["confluence/pages.json", cleanPage],
  ];

  for (const [relPath, transform] of jobs) {
    const items = await loadJson<Any[]>(relPath);
    const cleaned = items.map(transform);
    await saveJson(relPath, cleaned);
    console.log(`${relPath}: ${items.length}건 정제 완료`);
  }
}

await main();
