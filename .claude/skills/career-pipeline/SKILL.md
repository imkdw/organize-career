---
name: career-pipeline
description: 커리어 데이터 분석부터 이력서/포트폴리오 생성까지의 전체 파이프라인 오케스트레이터. "이력서 만들어줘", "포트폴리오 생성", "커리어 정리", "경력 분석해줘", "이직 준비", "파이프라인 실행/재실행", "이력서 업데이트/수정/보완", "분석만 다시", "특정 프로젝트만 다시 분석", "이전 결과 개선" 등 커리어 산출물 관련 모든 작업 요청 시 반드시 이 스킬을 사용할 것. 단순 데이터 조회 질문(예: "PR 몇 개야?")은 직접 응답 가능.
---

# Career Pipeline - 이력서/포트폴리오 생성 오케스트레이터

**실행 모드: 하이브리드** - Phase 2 분석은 서브 에이전트 병렬 팬아웃(클러스터가 독립적이라 팀 통신 불필요), Phase 3~4 집필/검증은 생성-검증 루프(서브 에이전트 순차). 데이터 전달은 파일 기반(`_workspace/`) + 반환값 기반.

**에이전트 스폰 규칙:** `subagent_type`에 커스텀 타입(career-analyst 등)이 등록돼 있으면 그것을 쓰고, 미등록이면(에이전트 파일이 세션 시작 후 생성된 경우) `general-purpose`로 스폰하되 프롬프트 첫 줄에 해당 에이전트 정의 파일(`.claude/agents/{name}.md`)을 읽으라고 지시한다.

**모델 티어링:** 단계별 요구 능력에 맞춰 모델을 지정한다 (에이전트 정의 frontmatter와 동일하게 유지).

| 에이전트 | model | 이유 |
|---|---|---|
| career-analyst | `opus` | 대량 데이터에서 성과 서사를 찾는 종합 판단. 병렬 N개 스폰 |
| resume-writer | `fable` | 최종 산출물의 문장력/취사선택이 품질을 결정. 1개만 스폰 |
| evidence-verifier | `sonnet` | grep/재계산 중심의 기계적 대조 |

정규화(Phase 1)는 스크립트라 모델을 쓰지 않는다. general-purpose 폴백 스폰 시에도 위 표의 `model` 파라미터를 명시한다.

## Phase 0: 컨텍스트 확인

실행 전 기존 산출물을 확인해 모드를 결정한다:

| 상태 | 모드 | 행동 |
|---|---|---|
| `_workspace/` 없음 | 초기 실행 | Phase 1부터 전체 실행 |
| `_workspace/` 있음 + 부분 수정 요청 | 부분 재실행 | 해당 Phase의 에이전트만 재스폰 (아래 "부분 재실행 매핑") |
| `_workspace/` 있음 + 데이터 재수집됨 (`data/` mtime이 더 최신) | 새 실행 | 기존 `_workspace/`를 `_workspace_prev/`로 이동 후 전체 실행 |

**부분 재실행 매핑:**
- "X 프로젝트 분석만 다시" → 해당 클러스터 career-analyst만 재스폰 → Phase 3부터 재개
- "이력서 표현/구성 수정" → resume-writer만 재스폰 (피드백 포함) → Phase 4 검증 재실행
- "검증만 다시" → evidence-verifier만 재스폰

## Phase 1: 데이터 정규화

`career-data-prep` 스킬을 따라 정규화를 실행/확인한다. 메인 세션이 직접 수행한다 (스크립트 실행이라 에이전트 불필요).

```bash
node .claude/skills/career-data-prep/scripts/normalize.mjs
```

완료 기준: `_workspace/normalized/summary.md` 존재 + 행 수 보고 정상.

## Phase 2: 성과 분석 (병렬 팬아웃)

1. 메인 세션이 `_workspace/normalized/summary.md`를 읽고 클러스터 3~5개를 설계한다.
   - 에픽 목록(하위 이슈 수 순)을 주제별로 묶고, 고아 이슈는 제목 키워드로 주제 배정
   - 각 클러스터에 필터 조건(에픽 키 목록 또는 키워드/기간)을 명시
2. 클러스터당 `career-analyst` 1개를 **동시에 스폰**한다 (`model: "opus"`, 백그라운드 병렬).
   - 스폰 프롬프트에 포함: 클러스터 정의 + 필터 조건 + 출력 경로(`_workspace/analysis/02_analyst_{슬러그}.md`) + "achievement-analysis 스킬을 먼저 읽어라"
3. 전원 완료 후 산출물 파일 존재를 확인한다.

## Phase 3: 집필

`resume-writer`를 스폰한다 (`model: "fable"`).
- 입력: `_workspace/analysis/*.md` 전체
- 출력: `output/resume.md`, `output/resume.html`(템플릿 기반, 프로젝트 섹션만 자동 채움), `_workspace/draft/03_writer_inventory.md`
- 스폰 프롬프트에 "resume-writing 스킬을 먼저 읽어라" 포함

## Phase 4: 근거 검증 (생성-검증 루프)

1. `evidence-verifier`를 스폰한다 (`model: "sonnet"`, 검증 스크립트 실행이 필요하므로 읽기 전용 타입 금지).
2. 전체 판정 FAIL이면: 검증 보고서 경로를 포함해 `resume-writer` 재스폰 → 재검증. **최대 2라운드.**
3. 2라운드 후에도 FAIL 항목이 남으면 해당 항목을 사용자에게 보고하고 수동 판단을 요청한다.

## Phase 5: 최종 보고

사용자에게 보고한다:
- 산출물 경로 (`output/resume.md`, `output/resume.html`)
- 성과 단위 수 (채택/전체), 검증 결과 요약 (PASS/WARN/FAIL 건수)
- WARN 항목 목록 (사용자가 표현 수위를 결정)
- 직접 작성 영역(소개/업무경험/학력/자격증) 안내 + PDF 필요 시 export 명령 실행 (`resume-writing` 스킬 참조)
- 피드백 요청: "결과에서 개선할 부분이 있나요?"

## 데이터 흐름

```
data/*.json (원본)
  → [Phase 1: normalize.mjs] → _workspace/normalized/*.jsonl + summary.md
  → [Phase 2: career-analyst xN 병렬] → _workspace/analysis/02_analyst_*.md
  → [Phase 3: resume-writer] → output/resume.md + output/resume.html + _workspace/draft/03_writer_inventory.md
  → [Phase 4: evidence-verifier] → _workspace/verify/04_verifier_report.md
  → (FAIL 시 Phase 3 재실행, 최대 2라운드)
```

## 에러 핸들링

| 상황 | 대응 |
|---|---|
| 정규화 스크립트 실패 | 에러 원인 수정 후 재실행 (데이터 스키마 변화 가능성 - normalize.mjs 보정) |
| analyst 1개 실패/무응답 | 1회 재스폰. 재실패 시 해당 클러스터 없이 진행하고 최종 보고에 누락 명시 |
| 분석 산출물 간 수치 상충 | 삭제하지 않고 보수적 수치 채택 + 각주 병기 (resume-writer 원칙) |
| 검증 2라운드 후 FAIL 잔존 | 자동 수정 중단, 사용자 판단 요청 |

## 테스트 시나리오

**정상 흐름**: "이력서 만들어줘" → Phase 0(초기) → 정규화 → 클러스터 4개 분석 → 집필 → 검증 PASS → 산출물 보고.

**에러 흐름**: 검증에서 "PR 1,200건" 주장이 데이터(984건 머지)와 불일치 → FAIL 보고서 → resume-writer 재스폰으로 수치 수정 → 재검증 PASS. 2라운드 후에도 FAIL이면 해당 불릿을 사용자에게 보고.

**후속 흐름**: "이력서 디자인만 바꿔줘" → Phase 0(부분 재실행) → 템플릿(`resume-writing` 스킬 assets)을 수정한 뒤 resume-writer만 재스폰(resume.html 재생성 지시) → 검증은 수치 변화 없으므로 스킵 가능(내용 변경 시에만 재검증).
