# Implementation Status (Task 1 MVP)

점검일: 2026-07-26

## 1. 점검 결과 요약

| 항목 | 이전 상태 | 조치 |
|------|-----------|------|
| `scripts/demo_risk.py` | 동작 | 유지·공식 점수식에 맞게 수정 |
| `training/train.py` | 골격만, 데이터 검증/imgsz 폴백 없음 | 실행형으로 재작성 |
| `training/evaluate.py` | 메트릭 일부만 | artifacts 저장·크기/환경별 분석 추가 |
| `training/augment.py` | Compose만, CLI 없음 | preview CLI 구현 |
| `inference/pipeline.py` | 동영상만, DB/저장 불완전 | 이미지·폴더·RTSP·저장·이벤트 완성 |
| `tracking/track_manager.py` | 단순 TTL | min_hits/max_age/cooldown/이벤트 통합 |
| `risk/engine.py` | 구 가중치 | Illegal Likelihood + REVIEW_REQUIRED |
| `priority/engine.py` | 거리·workload 중심 | P1–P4 행정 우선순위식 |
| 데이터셋 스크립트 | **없음** | `scripts/*` 7개 구현 |
| `datasets/banner/data.yaml` | configs만 존재 | `datasets/banner/data.yaml` 생성 |
| 공공데이터 | in-memory 임의 | CSV/GeoJSON sample + Repository |
| FastAPI | candidates 일부 | events/inference/risk API |
| Next.js `/cctv` | 로컬 mock만 | FastAPI 연동 + 오프라인 오류 표시 |
| tests | **없음** | pytest 6개 파일 |
| `samples/banner_test.mp4` | **없음** | 생성 스크립트로 생성 |
| Docker | PostGIS 의존 | API는 SQLite로 단독 기동 가능 |

## 2. 문서·코드 불일치 (수정)

- `configs/banner/data.yaml` → `datasets/banner/data.yaml` 를 학습 기본 경로로 통일
- API 경로: `/api/v1/events`, `/api/v1/inference/*`, `/api/v1/risk/calculate`
- Risk 티어: `LOW|MEDIUM|HIGH|REVIEW_REQUIRED` (구 urgent/priority 폐기)
- Priority: `P1|P2|P3|P4`

## 3. 실행 가능 목표 명령

```bash
python -m training.train --config configs/banner/train.yaml
python -m inference.pipeline --source samples/banner_test.mp4 --task banner
python scripts/demo_risk.py
uvicorn backend.app.main:app --reload --port 8000
pytest -q
```

## 4. 사용자 수동 작업 (자동화 불가)

AI Hub 데이터는 로그인·약관 동의가 필요하므로 자동 다운로드하지 않음.

배치 경로: `datasets/raw/aihub_banner/`

## 5. 실행 검증 결과 (2026-07-26)

| 명령 | 결과 |
|------|------|
| `pytest -q` | **13 passed** |
| `python scripts/demo_risk.py` | OK (Illegal Likelihood + Priority) |
| `python -m training.train --config configs/banner/train.yaml` | 데이터 없으면 명확한 FileNotFoundError + 배치 경로 안내 |
| `python -m training.train --config configs/banner/train_smoke.yaml` | 합성 샘플로 smoke 학습 → `weights/banner/best.pt` |
| `python -m inference.pipeline --source samples/banner_test.mp4 --task banner` | events≥1, JSON/MP4 저장 |
| `uvicorn backend.app.main:app --port 8000` | `/health`, `/api/v1/events` OK |

## 6. 남은 한계

- 현재 `weights/banner/best.pt`는 **합성 샘플 smoke 학습** 결과. 현장 성능 수치가 아님.
- 실서비스 학습은 AI Hub 수동 배치 후 `train.yaml`(imgsz 960, epochs 100) 사용.
- CCTV 좌표는 카메라 근사 위치이며 현수막 정밀 GPS가 아님.
- 불법 확정은 API에서 `CONFIRMED` + actor(공무원)로만 가능.
