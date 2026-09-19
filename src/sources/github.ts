import { githubConfig } from "../config.js";
import { fetchJson } from "../http.js";

const API = "https://api.github.com";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// search API secondary rate limit(분당 ~30회) 회피: 요청 간 2초 간격, 순차 실행
async function searchAll(path: string, query: string, headers: Record<string, string>) {
  const items: unknown[] = [];
  for (let page = 1; page <= 10; page++) {
    await sleep(2000);
    const data = await fetchJson<{ items: unknown[]; total_count: number }>(
      `${API}${path}?q=${encodeURIComponent(query)}&per_page=100&page=${page}`,
      headers,
    );
    items.push(...data.items);
    if (items.length >= data.total_count || data.items.length === 0) break;
  }
  return items;
}

export async function collectGithub() {
  const { token, username } = githubConfig();
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const pullRequests = await searchAll("/search/issues", `type:pr author:${username}`, headers);
  const reviewedPrs = await searchAll("/search/issues", `type:pr reviewed-by:${username} -author:${username}`, headers);
  const commits = await searchAll("/search/commits", `author:${username}`, headers);

  return { "pull-requests": pullRequests, "reviewed-prs": reviewedPrs, commits };
}
