# Banner Detection Model Card — Smart Icheon Care

최종 배포 모델: `weights/banner/final_all_30ep/best.pt`  
(로컬 바이너리, git에는 metrics/문서만 포함. `.pt`는 `.gitignore`)

생성일: 2026-07-29

---

## 1. 한 줄 요약

AI Hub 종합 민원 이미지의 **현수막(banner)** 객체를 탐지하는 **YOLO11s** 단클래스 검출기.  
시정 CCTV/업로드 영상에서 현수막 **존재 여부**만 판정한다. **불법 픽셀 분류(옵션2)** 는 공개 illegal/legal YOLO 라벨이 없어 보류한다. 제품은 **옵션1**: 탐지 + 공공데이터 Risk → `불법의심`, 그리고 **클릭 시 2단계 OCR/마크 내용 검사**로 보완한다.

---

## 2. 모델 구성

| 항목 | 내용 |
|------|------|
| Architecture | Ultralytics **YOLO11s** (Detection) |
| Task | Object detection |
| Classes | `0: banner` (단일 클래스) |
| Input | RGB, `imgsz=640` |
| Params | ~9.43M |
| Framework | PyTorch / Ultralytics 8.x |
| Train device | Apple Silicon **MPS** |
| Export | ONNX는 환경에 `onnx` 미설치로 실패 (추후 재시도) |

### 학습 설정 (최종 30ep)

- Config: `configs/banner/train_all_30ep.yaml`
- Base weights: `yolo11s.pt` (COCO pretrained → banner fine-tune)
- Epochs: **30**
- Dataset: `datasets/banner_mvp_all` (AI Hub TL2 기반 MVP)
  - train ≈ 11,967 / val ≈ 1,961
- Output dir: `runs/banner/final_all_30ep/`
- Packaged copy: `weights/banner/final_all_30ep/`, `weights/banner/release/`

---

## 3. 데이터

- 출처: AI Hub 「138. 종합 민원 이미지 AI데이터」 현수막 관련 카테고리
- MVP 구성: `banner_mvp_all` (전체 현수막 샘플 유지)
- A/B 실험: `banner_mvp_all` vs `banner_mvp_filtered`(초소형 &lt;8px 박스 제거)
- **공통 테스트셋 1,892장**으로 공정 비교 후 **all** 승자 → 30ep 최종 학습

---

## 4. 성능 지표

### 4.1 학습 val (30ep 종료, Ultralytics)

| Metric | Value |
|--------|------:|
| Precision | 0.591 |
| Recall | 0.538 |
| mAP50 | 0.510 |
| mAP50-95 | 0.305 |

출처: `weights/banner/final_all_30ep/metrics.json`

### 4.2 공통 테스트 1,892장 (10ep all과 동일 세트 — 발표/비교용)

| Metric | 10ep all | **30ep final** | Δ |
|--------|---------:|---------------:|--:|
| Precision | 0.5938 | **0.6329** | +3.92%p |
| Recall | 0.5286 | **0.5551** | +2.65%p |
| F1 | 0.5593 | **0.5914** | +3.22%p |
| mAP50 | 0.4088 | **0.4385** | +2.97%p |
| mAP50-95 | 0.2603 | **0.2786** | +1.83%p |
| Tiny Recall | 0.1935 | **0.2202** | +2.68%p |
| FP / FN | 1029 / 1551 | 1060 / **1424** | FN↓ |

출처: `artifacts/final_release_report.md`, `artifacts/final_model/comparison.md`

### 4.3 추론 속도 (벤치마크)

| Device | Latency | FPS |
|--------|--------:|----:|
| MPS | ~63.5 ms | ~15.7 |
| CPU | ~238.5 ms | ~4.2 |

출처: `artifacts/final_model/speed_benchmark.json`

---

## 5. 실험 결정 요약

1. MVP 10ep A/B: **all** (score 0.4913) > filtered (0.4811) — tiny recall도 all이 우위  
2. Winner `experiment_all` → **fresh 30ep** on `banner_mvp_all`  
3. Finalize: 공통테스트 재평가 + demo VIDEO/FALLBACK + verify  
4. Verify: workflow / API / risk-priority 테스트 **ALL CHECKS PASSED**

---

## 6. 시스템에서의 역할 (Human-in-the-loop)

```
이미지·영상 업로드 (또는 향후 RTSP)
  → YOLO banner detect (+ ByteTrack)          # 1단계: 존재
  → Event (DETECTED) + Risk/Priority
  → illegal_candidate / verdict
      (Risk≥70 → ILLEGAL_SUSPECT, else LOW_RISK)
  → (선택) 박스 클릭 → crop → OCR·키워드·마크 휴리스틱
      → content_verdict: ILLEGAL_SUSPECT | LIKELY_LEGAL | NEEDS_REVIEW
  → 대시보드 검토
  → DETECTED → REVIEW_PENDING → CONFIRMED → … → RESOLVED
     (또는 DISMISSED)
```

- **1단계 CV**: 현수막 **존재** + 공공데이터 Risk 기반 `불법의심` 배지.  
- **2단계 CV**: 클릭한 bbox만 OCR(easyocr)·금칙어/허가번호·도장 휴리스틱. 학습된 로고 분류기 아님(MVP).  
- **옵션2 부재**: 공개 데이터에 illegal/legal 2클래스 YOLO 라벨 없음 → 재학습 보류.  
- `CONFIRMED`는 공무원 확인 후에만 설정.  
- 상태 전이는 단방향 상태 머신 (`platform/event/workflow.py`).

### 대시보드 UX

- `/cctv`: **불법 현수막(의심) 탐지** — 업로드 → 박스 미리보기 + 클릭 시 내용 검사 패널  
- API: `POST /api/v1/inference/image|video`, `POST /api/v1/inference/inspect`  
- 이벤트 필터: `GET /api/v1/events?illegal_only=true`

---

## 7. 한계 / 주의

- Tiny object recall 여전히 낮음 (~0.22) — 원거리·작은 현수막 누락 가능  
- FP 소폭 증가(1029→1060) — 운영 시 conf 튜닝·사람 검토 필요  
- 학습 데이터는 AI Hub 도메인; 이천 CCTV 실환경과 도메인 갭 가능  
- 라이브 RTSP는 미연동 (업로드 MVP)  
- `.pt` 가중치는 git에 없음 — 배포 시 `weights/banner/final_all_30ep/best.pt`를 별도 전달  
- OCR은 각도·야간·저해상도에서 실패 → `NEEDS_REVIEW` (easyocr 미설치 시에도 동일)  
- 마크/도장 탐지는 휴리스틱이며 이천 지정 마크 DB가 생기면 교체  
- 금칙어 사전은 시드이며 법적 단속 기준 전체를 대체하지 않음

---

## 8. 재현 / 사용

```bash
cd platform
# 추론 (로컬 weights 필요)
PYTHONPATH=. python -m inference.pipeline \
  --source path/to/image.jpg \
  --weights weights/banner/final_all_30ep/best.pt \
  --camera-id CCTV-001

# API
MUNICIPAL_PUBLIC_DATA=fixtures/demo_public_data \
MUNICIPAL_EVENTS_DB=artifacts/events.db \
PYTHONPATH=. uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

웹: Next.js `:3000` → `/cctv`에서 이미지 탐지.

---

## 9. 관련 산출물

| Path | 내용 |
|------|------|
| `artifacts/BANNER_MODEL_CARD.md` | 이 문서 |
| `artifacts/final_release_report.md` | 릴리스 요약 |
| `artifacts/final_model/comparison.md` | 10ep vs 30ep |
| `artifacts/MVP_EXPERIMENT_RESULTS.md` | MVP A/B |
| `artifacts/PROJECT_STATUS_ALL.md` | 프로젝트 상태 |
| `weights/banner/final_all_30ep/metrics.json` | val metrics |
| `weights/banner/release/model_info.json` | 배포 메타 |
