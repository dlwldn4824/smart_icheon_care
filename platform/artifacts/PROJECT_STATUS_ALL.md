# Smart Icheon Care — 프로젝트 전체 현황 통합본

- 작성 시각: **2026-07-28 02:25 KST**
- 원칙: **실제로 측정·실행된 결과만** 기록. 미완료 항목은 추측 수치 없음.
- 위치: `platform/artifacts/PROJECT_STATUS_ALL.md`

---

## 0. 한 줄 요약

| 영역 | 상태 |
|------|------|
| 도시관리 MVP 파이프라인 (YOLO→ByteTrack→Event→Risk→Dashboard→Workflow) | **구현·동작 완료** |
| A/B 10epoch (`filtered` vs `all`) | **완료** · 공통 test 1892장 평가 완료 |
| 최종 선정 | **`all` (`banner_mvp_all`)** |
| 최종 30epoch 학습 | **진행 중** · **4/30 epoch 완료** · 약 **26시간** 남음 |
| 배포 패키지 / ONNX / 10vs30 최종 비교 | **대기** (30epoch 종료 후 자동 체인) |

---

## 1. 서비스 파이프라인 (구현 완료)

```
CCTV / sample video
  → YOLO11s 현수막 탐지
  → ByteTrack 추적
  → EventManager (NEW→TRACKING→FINISHED → 운영상태 DETECTED…)
  → Geo Mapping (camera_registry)
  → Public Data Join (CSV)
  → Risk Engine (rule, 0–100 + breakdown)
  → Priority Engine (Critical/High/Medium/Low)
  → FastAPI + Dashboard + 행정 Workflow
```

### 주요 실행

```bash
cd platform
python run_demo.py --demo          # 데모 (VIDEO 0건 시 DEMO_FALLBACK)
uvicorn backend.app.main:app --port 8000
# Dashboard: http://127.0.0.1:8000/dashboard
```

### 운영 상태 머신

```
DETECTED → REVIEW_PENDING | DISMISSED
REVIEW_PENDING → CONFIRMED | DISMISSED
CONFIRMED → ASSIGNED
ASSIGNED → IN_PROGRESS
IN_PROGRESS → RESOLVED
```

`CONFIRMED` / `ASSIGNED` / `RESOLVED` 는 `actor` 필수.

### Risk Score (rule)

```
base 30
+ complaint_hotspot 20
+ school_zone 15
+ high_population 10
+ no_permission 15
+ far_from_legal_board 10
→ 0~100 (합 상한 100)
```

### 핵심 경로

| 구분 | 경로 |
|------|------|
| 데모 | `run_demo.py` |
| 파이프라인 | `inference/pipeline.py` |
| Event | `event/event_manager.py`, `event/workflow.py` |
| Risk/Priority | `risk/risk_engine.py`, `priority/priority_engine.py` |
| API | `backend/app/main.py` |
| fixtures | `fixtures/demo_camera.csv`, `fixtures/demo_public_data/` |
| 검증 | `scripts/verify_demo.py` |

---

## 2. 데이터셋

| 데이터셋 | train | val | test | 비고 |
|----------|------:|----:|-----:|------|
| `datasets/banner` | (원본 ~160k) | | | AI Hub TL2 변환본, 보존 |
| `datasets/banner_mvp_all` | 11967 | 1961 | 2072 | tiny box 포함 · **최종 학습 선택** |
| `datasets/banner_mvp_filtered` | 10960 | 1791 | 1892 | w/h &lt; 8px 제외 |

공통 설계: 가로/세로 × 낮/밤 균형, group-aware split seed 42.

---

## 3. 실험 A — filtered 10 epoch (완료)

| 항목 | 값 |
|------|-----|
| 설정 | `configs/banner/experiment_filtered.yaml` |
| 데이터 | `banner_mvp_filtered` |
| 소요 | 약 **10.7시간** |
| 가중치 | `weights/banner/experiment_filtered/best.pt` |
| 로그 | `artifacts/exp_mvp_filtered.log` |
| run | `runs/banner/exp_mvp_filtered_10ep/` |

### 자체 val best (학습 중 val, epoch 10)

| Precision | Recall | mAP50 | mAP50-95 |
|----------:|-------:|------:|---------:|
| 0.589 | 0.545 | 0.521 | 0.317 |

> 이 수치는 **filtered 자체 val** 기준. A/B 최종 비교에는 쓰지 않음.

---

## 4. 실험 B — all 10 epoch (완료)

| 항목 | 값 |
|------|-----|
| 설정 | `configs/banner/experiment_all.yaml` |
| 데이터 | `banner_mvp_all` |
| 상태 | **완료** (`exit_code=0`) |
| 가중치 | `weights/banner/experiment_all/best.pt` |
| 로그 | `artifacts/exp_mvp_all.log` |
| run | `runs/banner/experiment_all/` |

### 자체 val (학습 종료 시점 ultralytics_results)

| Precision | Recall | mAP50 | mAP50-95 |
|----------:|-------:|------:|---------:|
| 0.560 | 0.493 | 0.469 | 0.280 |

> 이 수치는 **all 자체 val** 기준. A/B 최종 비교에는 쓰지 않음.

---

## 5. A/B 공통 Test 평가 (완료) — 선정 근거

- 스크립트: `scripts/compare_banner_experiments.py`
- 공통 test: **1892장** (all ∩ filtered filename intersection)
- GT: `banner_mvp_all` 라벨
- conf=0.25, imgsz=640, device=mps
- 산출: `artifacts/experiment_comparison/`

### Overall (공통 test)

| model | P | R | F1 | mAP50 | mAP50-95 | avg conf | infer ms | FPS | TP | FP | FN | score |
|-------|--:|--:|---:|------:|---------:|---------:|---------:|----:|---:|---:|---:|------:|
| **all** | **0.5938** | **0.5286** | **0.5593** | **0.4088** | **0.2603** | 0.4884 | 133.0 | 7.52 | 1618 | 1029 | 1551 | **0.4913** |
| filtered | 0.5883 | 0.5172 | 0.5505 | 0.3943 | 0.2502 | 0.5015 | 142.7 | 7.01 | 1576 | 1026 | 1593 | 0.4811 |

내부 점수: `0.35*R + 0.30*P + 0.25*mAP50 + 0.10*mAP50-95`

### Tiny (공통 test)

| | Recall | mAP50 |
|--|-------:|------:|
| all | **0.193** | 0.005 |
| filtered | 0.083 | 0.001 |

### 크기별 (요약)

| size | all R | filtered R |
|------|------:|-----------:|
| tiny | 0.193 | 0.083 |
| small | 0.410 | 0.398 |
| medium | 0.597 | 0.593 |
| large | 0.698 | 0.716 |

### 유형 (Recall 요약)

| 유형 | all R | filtered R |
|------|------:|-----------:|
| 가로(낮) | 0.576 | 0.602 |
| 가로(밤) | 0.570 | 0.570 |
| 세로(낮) | 0.494 | 0.453 |
| 세로(밤) | 0.412 | 0.377 |

### 추천

**`all` (`datasets/banner_mvp_all`)**

이유 (실측):
- 공통 test score / Recall / mAP 우위
- Tiny Recall 명확히 우위 (0.193 vs 0.083)
- FP는 거의 동일 (1029 vs 1026)

### 산출물

- `artifacts/experiment_comparison/comparison.md`
- `comparison.csv` / `comparison.json` / `report_summary.md`
- `common_test_manifest.csv`
- `all_fp/`, `all_fn/`, `filtered_fp/`, `filtered_fn/` (각 20장)

---

## 6. 최종 30 epoch 학습 — 진행 중 (작성 시점)

| 항목 | 값 |
|------|-----|
| 상태 | **RUNNING** |
| 설정 | `configs/banner/train_all_30ep.yaml` |
| 데이터 | `banner_mvp_all` |
| 초기 가중치 | **`yolo11s.pt` fresh** (10ep best resume 아님) |
| device / imgsz / batch | MPS / 640 / 8 |
| epochs | 30 · patience 10 |
| 시작 | 2026-07-27 22:08경 |
| 작성 시점 진행 | **4 / 30 epoch 완료** · Epoch 5 진행 추정 |
| 경과 | 약 **4.0시간** (results.csv 누적 14426s ≈ 4.01h) |
| 평균 | **약 1.0시간 / epoch** |
| 남은 예상 | **약 26시간** → 대략 **2026-07-29 새벽 ~04:30** |
| 로그 | `artifacts/train_all_30ep.log` |
| run | `runs/banner/final_all_30ep/` |
| 중간 weights | `runs/banner/final_all_30ep/weights/best.pt`, `last.pt` |
| 최종 export (종료 시) | `weights/banner/final_all_30ep/{best,last,metrics,results}` |

### Val 추이 (학습 중 자체 val — 최종 발표용 아님)

| Epoch | P | R | mAP50 | mAP50-95 | 누적(s) |
|------:|--:|--:|------:|---------:|--------:|
| 1 | 0.287 | 0.246 | 0.144 | 0.066 | 4595 |
| 2 | 0.349 | 0.295 | 0.229 | 0.111 | 7084 |
| 3 | 0.387 | 0.335 | 0.278 | 0.151 | 11384 |
| 4 | 0.396 | 0.357 | 0.289 | 0.149 | 14427 |

> **주의**: 위는 30ep 학습의 **자체 val**입니다.  
> 10ep 공통 test(P 0.59 등)와 직접 비교하지 마세요.  
> 30ep 종료 후 **같은 공통 test 1892장**으로 재평가합니다.

### 종료 후 자동 예정

```text
train 완료
  → scripts/finalize_banner_model.py
      · 공통 test 재평가
      · 10ep vs 30ep 비교 → artifacts/final_model/
      · release 패키징 → weights/banner/release/
      · ONNX 시도
      · VIDEO / DEMO_FALLBACK 데모
      · FPS (MPS/CPU)
  → scripts/verify_demo.py --require-final
  → artifacts/final_release_report.md 갱신
```

---

## 7. 데모 / API (이미 동작 확인된 것)

| 항목 | 내용 |
|------|------|
| `run_demo.py --demo` | sample video 탐지 0건 → **DEMO_FALLBACK** (val 이미지) |
| 데모 카메라 | `DEMO-CCTV-001` (설봉동·학교 인접 fixture) |
| Risk 예시 (fixture) | score **100**, priority **Critical** |
| API | `/events`, `/statistics`, `/dashboard`, PATCH status |
| Next.js | `/cctv` · `NEXT_PUBLIC_VISION_API_URL` |

---

## 8. 중요 파일 인덱스

### 학습 / 비교
- `configs/banner/experiment_filtered.yaml`
- `configs/banner/experiment_all.yaml`
- `configs/banner/train_all_30ep.yaml`
- `scripts/compare_banner_experiments.py`
- `scripts/finalize_banner_model.py`
- `scripts/verify_demo.py`
- `scripts/run_final_all_30ep.sh`

### 가중치
- `weights/banner/experiment_filtered/best.pt` ✅
- `weights/banner/experiment_all/best.pt` ✅
- `weights/banner/final_all_30ep/` ⏳ (학습 종료 후)
- `weights/banner/release/` ⏳

### 로그 / 리포트
- `artifacts/exp_mvp_filtered.log`
- `artifacts/exp_mvp_all.log`
- `artifacts/train_all_30ep.log` ← **현재 live**
- `artifacts/experiment_comparison/`
- `artifacts/MVP_EXPERIMENT_RESULTS.md` (초기 A/B 메모)
- **본 파일** `artifacts/PROJECT_STATUS_ALL.md`

---

## 9. 모니터링 명령

```bash
cd platform

# 학습 로그
tail -f artifacts/train_all_30ep.log

# 완료 epoch 수 / val
cat runs/banner/final_all_30ep/results.csv

# 프로세스
pgrep -fl "training.train"
```

---

## 10. 남은 일 (학습 종료 후)

1. 공통 test 1892로 30ep 재평가  
2. 10ep all vs 30ep final 비교표  
3. Tiny / FP / FN / FPS  
4. VIDEO + DEMO_FALLBACK 검증  
5. `weights/banner/release/` 패키징 + ONNX  
6. `artifacts/final_release_report.md` 실측 수치로 확정  

---

## 11. 수치 해석 가이드 (혼동 방지)

| 숫자 출처 | 의미 | 발표에 |
|-----------|------|--------|
| filtered/all **자체 val** (10ep 학습 중) | 각 데이터셋 val split | 참고만 |
| **공통 test 1892** A/B | 공정 비교 · 모델 선정 | **사용** |
| 30ep **자체 val** (현재 ep1–4) | 학습 진행 모니터링 | 선정 비교 ❌ |
| 30ep **공통 test** (종료 후) | 최종 배포 성능 | **최종 사용** |

---

*이 문서는 2026-07-28 02:25 기준 스냅샷입니다. 30epoch 종료 후 `finalize` 결과가 나오면 본 파일 또는 `final_release_report.md`를 갱신하세요.*
