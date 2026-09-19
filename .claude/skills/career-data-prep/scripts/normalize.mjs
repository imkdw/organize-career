#!/usr/bin/env node
// data/ 원본(JSON, ~54MB)을 AI가 읽을 수 있는 컴팩트 JSONL + 통계 다이제스트로 정규화한다.
// 사용법: node .claude/skills/career-data-prep/scripts/normalize.mjs
// 출력: _workspace/normalized/{jira,prs,reviewed-prs,commits,confluence}.jsonl + summary.md
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, '_workspace', 'normalized');
mkdirSync(OUT, { recursive: true });

const read = (p) => JSON.parse(readFileSync(join(ROOT, 'data', p), 'utf8'));
const writeJsonl = (name, rows) =>
  writeFileSync(join(OUT, name), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

// Atlassian ADF(문서 객체) → 평문
function adfText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  const own = node.text ?? '';
  const children = (node.content ?? []).map(adfText).join(' ');
  return [own, children].filter(Boolean).join(' ');
}
const clip = (s, n) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
};
const stripHtml = (html) =>
  (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ');
const jiraKeys = (s) => [...new Set((s ?? '').match(/[A-Z][A-Z0-9]+-\d+/g) ?? [])];

// ---- Jira ----
const issues = read('jira/issues.json');
const jiraRows = issues.map((i) => {
  const f = i.fields;
  return {
    key: i.key,
    project: f.project?.key,
    type: f.issuetype?.name,
    summary: f.summary,
    status: f.status?.name,
    parent: f.parent?.key ?? null,
    parentSummary: f.parent?.fields?.summary ?? null,
    created: (f.created ?? '').slice(0, 10),
    resolved: (f.resolutiondate ?? '').slice(0, 10) || null,
    labels: f.labels?.length ? f.labels : undefined,
    desc: clip(adfText(f.description), 400) || undefined,
  };
});
writeJsonl('jira.jsonl', jiraRows);

// ---- GitHub PRs (작성) ----
const prs = read('github/pull-requests.json');
const prRows = prs.map((p) => ({
  n: p.number,
  repo: p.repository_url.split('/').pop(),
  title: p.title,
  created: p.created_at.slice(0, 10),
  merged: p.pull_request?.merged_at?.slice(0, 10) ?? null,
  labels: p.labels?.map((l) => l.name),
  jira: jiraKeys(p.title + ' ' + (p.body ?? '')),
  body: clip(p.body, 400) || undefined,
}));
writeJsonl('prs.jsonl', prRows);

// ---- GitHub PRs (리뷰) ----
const reviewed = read('github/reviewed-prs.json');
writeJsonl(
  'reviewed-prs.jsonl',
  reviewed.map((p) => ({
    n: p.number,
    repo: p.repository_url.split('/').pop(),
    title: p.title,
    author: p.user?.login,
    closed: p.closed_at?.slice(0, 10) ?? null,
  })),
);

// ---- GitHub Commits ----
const commits = read('github/commits.json');
writeJsonl(
  'commits.jsonl',
  commits.map((c) => ({
    repo: c.repository?.name,
    date: c.commit?.author?.date?.slice(0, 10),
    msg: clip((c.commit?.message ?? '').split('\n')[0], 150),
  })),
);

// ---- Confluence ----
const pages = read('confluence/pages.json');
writeJsonl(
  'confluence.jsonl',
  pages.map((p) => ({
    id: p.id,
    title: p.title,
    space: p.space?.name,
    created: p.history?.createdDate?.slice(0, 10),
    updated: p.version?.when?.slice(0, 10),
    body: clip(stripHtml(p.body?.storage?.value), 600) || undefined,
  })),
);

// ---- summary.md ----
const count = (rows, fn) => {
  const m = {};
  for (const r of rows) {
    const k = fn(r);
    if (k) m[k] = (m[k] ?? 0) + 1;
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};
const table = (pairs) => pairs.map(([k, v]) => `| ${k} | ${v} |`).join('\n');
const epics = jiraRows.filter((r) => r.type === '에픽');
const childCount = count(jiraRows.filter((r) => r.parent), (r) => r.parent);
const childMap = Object.fromEntries(childCount);
const dates = jiraRows.map((r) => r.created).filter(Boolean).sort();

const summary = `# 정규화 데이터 다이제스트

생성 스크립트: \`.claude/skills/career-data-prep/scripts/normalize.mjs\`

## 데이터 범위와 주의사항

- Jira 이슈 ${jiraRows.length}건 (${dates[0]} ~ ${dates.at(-1)})
- GitHub 작성 PR ${prRows.length}건 / 리뷰 PR ${reviewed.length}건 / 커밋 ${commits.length}건
- Confluence 문서 ${pages.length}건
- **주의: GitHub 데이터는 검색 API 1,000건 캡으로 최근 데이터만 존재** (PR: ${prRows.map((p) => p.created).sort()[0]} 이후). 그 이전 기간의 구현 활동은 Jira 이슈로 추적할 것.

## Jira 프로젝트 분포

| 프로젝트 | 이슈 수 |
|---|---|
${table(count(jiraRows, (r) => r.project))}

## 이슈 유형 분포

| 유형 | 건수 |
|---|---|
${table(count(jiraRows, (r) => r.type))}

## 월별 활동량 (Jira 이슈 생성 기준)

| 월 | 건수 |
|---|---|
${table(count(jiraRows, (r) => r.created?.slice(0, 7)).sort((a, b) => a[0].localeCompare(b[0])))}

## 에픽 목록 (${epics.length}개) - 클러스터링 시드

| 에픽 키 | 제목 | 하위 이슈 수 | 생성일 |
|---|---|---|---|
${epics
  .sort((a, b) => (childMap[b.key] ?? 0) - (childMap[a.key] ?? 0))
  .map((e) => `| ${e.key} | ${e.summary} | ${childMap[e.key] ?? 0} | ${e.created} |`)
  .join('\n')}

## Confluence 스페이스 분포

| 스페이스 | 문서 수 |
|---|---|
${table(count(pages, (p) => p.space?.name))}
`;
writeFileSync(join(OUT, 'summary.md'), summary);

console.log('normalized →', OUT);
for (const [name, rows] of [
  ['jira', jiraRows],
  ['prs', prRows],
  ['reviewed-prs', reviewed],
  ['commits', commits],
  ['confluence', pages],
])
  console.log(`  ${name}: ${rows.length} rows`);
