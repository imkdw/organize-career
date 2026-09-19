export async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${url}\n${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export function atlassianAuthHeader(email: string, apiToken: string): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`,
    Accept: "application/json",
  };
}
