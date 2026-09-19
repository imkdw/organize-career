import { atlassianConfig } from "../config.js";
import { atlassianAuthHeader, fetchJson } from "../http.js";

export async function collectJira() {
  const { baseUrl, email, apiToken } = atlassianConfig();
  const headers = atlassianAuthHeader(email, apiToken);
  const jql = "assignee = currentUser() OR reporter = currentUser() ORDER BY updated DESC";

  const issues: unknown[] = [];
  let nextPageToken: string | undefined;
  do {
    const params = new URLSearchParams({ jql, fields: "*all", maxResults: "100" });
    if (nextPageToken) params.set("nextPageToken", nextPageToken);
    const data = await fetchJson<{ issues: unknown[]; nextPageToken?: string }>(
      `${baseUrl}/rest/api/3/search/jql?${params}`,
      headers,
    );
    issues.push(...data.issues);
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return { issues };
}
