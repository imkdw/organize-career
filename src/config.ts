// 모든 환경변수는 이 파일에서만 읽는다. 값 세팅은 .env 파일에서 (.env.example 참고).
// 소스별로 함수를 분리해서, 특정 소스만 수집할 땐 그 소스의 변수만 있으면 된다.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name} 누락 — .env 파일을 확인하세요`);
  return value;
}

export function githubConfig() {
  return {
    token: required("GITHUB_TOKEN"),
    username: required("GITHUB_USERNAME"),
  };
}

// Jira/Confluence 공용 (Atlassian Cloud 기준: 이메일 + API 토큰)
export function atlassianConfig() {
  return {
    baseUrl: required("ATLASSIAN_BASE_URL").replace(/\/$/, ""), // 예: https://my-org.atlassian.net
    email: required("ATLASSIAN_EMAIL"),
    apiToken: required("ATLASSIAN_API_TOKEN"),
  };
}
