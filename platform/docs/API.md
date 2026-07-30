# API 명세 (구현됨)

Base: `http://127.0.0.1:8000`

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 헬스체크 |
| GET | `/api/v1/events` | 탐지 이벤트 목록 |
| GET | `/api/v1/events/{id}` | 이벤트 상세 |
| PATCH | `/api/v1/events/{id}/status` | 상태 변경 |
| POST | `/api/v1/risk/calculate` | Risk/Priority 계산 |
| POST | `/api/v1/inference/image` | 이미지 추론 |
| POST | `/api/v1/inference/video` | 영상 추론 |

## 상태

`DETECTED` → `REVIEWING` → `CONFIRMED` | `DISMISSED` | `RESOLVED`

`CONFIRMED`는 **공무원 actor 필수**. 시스템이 자동으로 불법을 확정하지 않음.

OpenAPI: `/docs`
