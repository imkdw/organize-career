# organize-career

회사 재직 중 작업 내역(Jira/GitHub/Confluence)을 수집해 이직/취업용 이력서와 포트폴리오를 자동 생성하는 프로젝트.

- `src/` - 데이터 수집기 (pnpm collect)
- `data/` - 수집된 원본 JSON (git 미추적)
- `_workspace/` - 파이프라인 중간 산출물
- `output/` - 최종 이력서/포트폴리오

## 하네스: 커리어 분석/이력서 생성

**목표:** data/ 원본을 분석해 근거 기반 이력서(resume.md)와 이력서 HTML(resume.html)를 자동 생성한다.

**트리거:** 이력서/포트폴리오/경력 분석/커리어 정리 관련 작업 요청 시 `career-pipeline` 스킬을 사용하라. 단순 데이터 조회 질문은 직접 응답 가능.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-07-29 | 초기 구성 (에이전트 3, 스킬 4) | 전체 | - |
| 2026-07-29 | 모델 티어링 (analyst=opus, writer=fable, verifier=sonnet) | agents/\*, skills/career-pipeline | 전 에이전트 opus는 과잉 - 단계별 요구 능력에 맞춤 |
| 2026-07-29 | 임팩트 중심 집필 규칙 (XYZ 공식, 기술 판단 서사, 임팩트 등급 A~D) | skills/resume-writing, skills/achievement-analysis | 기능 나열식 이력서 방지 - 오픈소스 이력서 가이드 리서치 반영 |
| 2026-07-29 | portfolio.html → 템플릿 기반 resume.html + PDF export. 프로젝트 섹션만 자동, 소개/업무경험/학력/자격증은 직접 작성 플레이스홀더 | skills/resume-writing (assets/resume-template.html 추가), agents, career-pipeline | 이력서 템플릿 형태 산출 + PDF 제공 요청. Figma 템플릿은 접근 권한 없어 심플 자체 템플릿으로 대체 (권한 열리면 교체) |
