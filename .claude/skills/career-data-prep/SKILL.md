---
name: career-data-prep
description: data/ 원본(Jira 이슈, GitHub 커밋/PR/리뷰, Confluence 문서 ~54MB)을 AI가 분석 가능한 컴팩트 JSONL과 통계 다이제스트로 정규화. "데이터 정규화", "데이터 전처리", "데이터 다시 수집했어", "정규화 다시 돌려줘" 요청 시, 그리고 커리어 분석 파이프라인 시작 전 정규화 데이터가 없거나 오래됐을 때 반드시 이 스킬을 사용할 것.
---

# Career Data Prep - 원본 데이터 정규화

## 왜 필요한가

data/ 원본은 API 응답 그대로라 ~54MB다. AI가 직접 읽으면 컨텍스트가 즉시 고갈된다. 결정적 스크립트로 필요한 필드만 추출해 ~2MB JSONL로 압축하고, 전체 통계는 summary.md 한 장으로 만든다. AI 분석은 항상 정규화 산출물 위에서 시작한다.

## 실행

```bash
node .claude/skills/career-data-prep/scripts/normalize.mjs
```

출력 (`_workspace/normalized/`):

| 파일 | 내용 | 주요 필드 |
|---|---|---|
| `jira.jsonl` | Jira 이슈 전건 | key, project, type, summary, status, parent, parentSummary, created, resolved, desc |
| `prs.jsonl` | 작성한 PR | n, repo, title, created, merged, labels, jira(연결된 이슈 키), body |
| `reviewed-prs.jsonl` | 리뷰한 PR | n, repo, title, author, closed |
| `commits.jsonl` | 커밋 | repo, date, msg |
| `confluence.jsonl` | 작성 문서 | id, title, space, created, updated, body |
| `summary.md` | 전체 통계 다이제스트 | 프로젝트/유형/월별 분포, 에픽 목록(하위 이슈 수 포함), 주의사항 |

## 재실행 판단

- `data/`의 mtime이 `_workspace/normalized/`보다 최신이면 재실행한다 (데이터 재수집 후).
- 스크립트는 멱등하다. 언제 다시 돌려도 안전하다.

## jsonl 조회 패턴

분석 에이전트는 전체 파일을 Read하지 말고 필터링해서 읽는다:

```bash
# 특정 에픽의 하위 이슈
grep '"parent":"PPLSC-123"' _workspace/normalized/jira.jsonl

# 특정 Jira 키가 연결된 PR
grep 'PPLSC-123' _workspace/normalized/prs.jsonl

# 조건 집계는 node로
node -e "const rs=require('fs').readFileSync('_workspace/normalized/prs.jsonl','utf8').trim().split('\n').map(JSON.parse); console.log(rs.filter(r=>r.merged).length)"
```

## 알려진 한계

- GitHub 검색 API는 1,000건 캡 - 커밋/PR은 최근 데이터만 존재한다. 캡 이전 기간의 활동은 Jira 이슈로 추적하라. summary.md에 실제 커버 기간이 명시된다.
- Jira desc는 400자, Confluence body는 600자로 잘린다. 전문이 필요하면 원본 `data/*.json`에서 해당 ID로 찾는다.
