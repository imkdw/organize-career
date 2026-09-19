import { atlassianConfig } from "../config.js";
import { atlassianAuthHeader, fetchJson } from "../http.js";

export async function collectConfluence() {
  const { baseUrl, email, apiToken } = atlassianConfig();
  const headers = atlassianAuthHeader(email, apiToken);

  const pages: unknown[] = [];
  let next: string | undefined = `/wiki/rest/api/content/search?${new URLSearchParams({
    cql: "type = page AND creator = currentUser() ORDER BY created DESC",
    expand: "body.storage,space,version,history",
    limit: "50",
  })}`;

  while (next) {
    const data: { results: unknown[]; _links: { next?: string } } = await fetchJson(`${baseUrl}${next}`, headers);
    pages.push(...data.results);
    next = data._links.next ? `/wiki${data._links.next}` : undefined;
  }

  return { pages };
}
