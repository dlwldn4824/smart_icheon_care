# AI Municipal Vision Platform

지자체 CCTV + 공공데이터 기반 **도시 관리 CV 플랫폼**.  
MVP Task는 **불법 현수막(의심)** 의사결정 지원입니다.

> YOLO는 “불법”을 픽셀로 확정하지 않습니다 (공개 illegal/legal 2클래스 데이터 부재).  
> **1단계**: 현수막 존재 탐지 + 허가·GIS·민원 Risk → `불법의심`.  
> **2단계**: 사용자가 박스를 클릭하면 OCR·키워드·마크 휴리스틱으로 내용 검사.  
> **최종**: 공무원 `CONFIRMED`.

## Task Roadmap

| Task | 모듈 | 상태 |
|------|------|------|
| Task 1 | Banner presence + illegal-suspect (Risk/HITL) | MVP |
| Task 2 | Illegal Dumping | Planned |
| Task 3 | Road Damage / Pothole | Planned |
| Task 4 | Child Safety Zone Risk | Planned |
| Task 5 | Elderly Safety Risk | Planned |

## Pipeline

```text
CCTV → Frame Sampling → YOLO Detection → ByteTrack
  → Geo Mapping → 공공데이터 Join → Risk/Priority → illegal_candidate
  → (optional click) crop → OCR/content rules → content_verdict
  → Dashboard → Officer CONFIRMED
```

## Quick Start

```bash
cd platform
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 샘플 영상 생성 + 검증
python scripts/generate_sample_assets.py
python scripts/demo_risk.py
pytest -q

# 학습 (AI Hub 데이터를 datasets/raw/aihub_banner 에 배치·변환 후)
python -m training.train --config configs/banner/train.yaml

# 추론
python -m inference.pipeline --source samples/banner_test.mp4 --task banner --save-video

# API
uvicorn backend.app.main:app --reload --port 8000
```

Next.js `/cctv`는 `NEXT_PUBLIC_VISION_API_URL` (기본 `http://127.0.0.1:8000`)로 이벤트를 불러옵니다.

Docker:

```bash
docker compose up --build
```

## 문서

| 문서 | 내용 |
|------|------|
| [artifacts/BANNER_MODEL_CARD.md](artifacts/BANNER_MODEL_CARD.md) | **최종 30ep 모델 카드 (성능·실험·한계)** |
| [artifacts/final_release_report.md](artifacts/final_release_report.md) | 릴리스 수치 요약 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 전체 시스템 구조 |
| [docs/MODEL_SELECTION.md](docs/MODEL_SELECTION.md) | YOLO11/12/26 비교·선정 |
| [docs/DATASETS.md](docs/DATASETS.md) | 데이터셋 조사·추천 순위 |
| [docs/ANNOTATION.md](docs/ANNOTATION.md) | 라벨·증강·학습 전략 |
| [docs/INFERENCE.md](docs/INFERENCE.md) | 추론·ByteTrack |
| [docs/RISK_PRIORITY.md](docs/RISK_PRIORITY.md) | Risk / Priority 엔진 |
| [docs/API.md](docs/API.md) | FastAPI 명세 |
| [docs/ERD.md](docs/ERD.md) | DB ERD |
| [docs/DASHBOARD.md](docs/DASHBOARD.md) | Dashboard 설계 |

프론트엔드 대시보드는 저장소 루트의 Next.js 앱(`/cctv`)과 연동합니다.

## 권장 모델 (MVP)

**YOLO11s** — 업로드/샘플링 추론·안정성·지자체 노트북(MPS/CPU) 환경 균형. 공식 속도: MPS ~15.7 FPS.  
근거: [MODEL_SELECTION.md](docs/MODEL_SELECTION.md)

> Ultralytics는 YOLO12를 프로덕션에 비권장(학습 불안정·CPU 저하).  
> YOLO26은 엣지/NMS-free 후보로 Phase-2 검증 후 이관.

## Repository 구조

```text
platform/
├── configs/           # task·학습·클래스 YAML
├── models/            # Detector / VisionTask OOP
├── training/          # train / augment / evaluate
├── tracking/          # ByteTrack + TrackManager
├── inference/         # FrameSampler + Pipeline
├── geospatial/        # GeoMapper + Join
├── risk/              # RiskEngine
├── content/           # Stage-2 OCR/keyword/mark inspect (illegal_text, inspect)
├── priority/          # PriorityEngine
├── backend/           # FastAPI + PostGIS schema
├── datasets/          # YOLO layout (gitignored images)
├── weights/           # best.pt 등
├── docs/              # 연구 설계 문서
├── scripts/demo_risk.py
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

## Risk 스모크 테스트 (GPU 불필요)

```bash
python scripts/demo_risk.py
```

산출물 전체 목록: [docs/RESEARCH_INDEX.md](docs/RESEARCH_INDEX.md)
