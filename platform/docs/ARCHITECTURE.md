# 1. 전체 시스템 아키텍처

## 1.1 플랫폼 포지셔닝

본 시스템은 **단일 불법 현수막 탐지기**가 아니라:

> **AI Municipal Vision Platform** — CCTV 기반 도시 이상 탐지·위험도·행정 우선순위를 제공하는 확장형 CV 플랫폼

Task 1(현수막)은 첫 모듈이며, 무단투기·도로파손·보호구역 위험 등으로 **동일 파이프라인 인터페이스**를 재사용합니다.

## 1.2 End-to-End 흐름

```text
┌─────────┐   ┌────────────────┐   ┌──────────────────┐   ┌────────────┐
│  CCTV   │──▶│ Frame Sampling │──▶│ YOLO Detection   │──▶│  NMS       │
└─────────┘   │ 1~2 fps        │   │ (task=banner)    │   └─────┬──────┘
              └────────────────┘   └──────────────────┘         │
                                                                ▼
┌────────────┐   ┌────────────────┐   ┌──────────────────┐   ┌────────────┐
│ Dashboard  │◀──│ Priority Score │◀──│ Risk / Illegal   │◀──│ ByteTrack  │
│ (Next.js)  │   │ 행정 대응 순위  │   │ Possibility      │   │ Track ID   │
└────────────┘   └────────────────┘   └────────▲─────────┘   └─────┬──────┘
                                               │                     │
                                      ┌────────┴─────────┐   ┌───────▼──────┐
                                      │ 공공데이터 Join   │◀──│ Geo Mapping  │
                                      │ PostGIS / GIS    │   └──────────────┘
                                      └──────────────────┘
```

## 1.3 단계별 역할

| 단계 | 역할 | 왜 필요한가 |
|------|------|-------------|
| **CCTV** | RTSP/파일 스트림 입력 | 기존 시정 인프라 재사용 |
| **Frame Sampling** | 30fps → 1~2fps 추출 | 중복·연산량 폭증 방지 |
| **YOLO Detection** | `banner` 바운딩박스·confidence | 행정 판단의 시각 근거 |
| **NMS** | 중복 박스 억제 | YOLO 후처리 안정화 (YOLO26 e2e는 생략 가능) |
| **ByteTrack** | Track ID·시간 연속성 | 동일 현수막을 1건으로 통합 |
| **Geo Mapping** | 픽셀 → WGS84 (카메라 캘리브/호모그래피 또는 CCTV 대표좌표) | GIS·허가 DB와 Join |
| **공공데이터 조회** | 허가·보호구역·민원·사고 | 합법/불법은 행정정보로만 추정 |
| **Risk Score** | 불법 가능성·안전 위험 종합 (0–100) | “얼마나 위험한 후보인가” |
| **Priority Score** | 인력·거리·긴급도 반영 순위 | “무엇을 먼저 확인할까” |
| **Dashboard** | 지도·근거·조치 UI | 공무원 최종 판단 |

## 1.4 논리 계층

```text
┌─────────────────────────────────────────────┐
│ Presentation   Next.js Dashboard (/cctv)    │
├─────────────────────────────────────────────┤
│ API            FastAPI + OpenAPI            │
├─────────────────────────────────────────────┤
│ Decision       RiskEngine / PriorityEngine  │
├─────────────────────────────────────────────┤
│ Spatial        GeoMapper / PostGIS Join     │
├─────────────────────────────────────────────┤
│ Perception     Detector / Tracker (Task*)   │
├─────────────────────────────────────────────┤
│ Data           PostgreSQL + PostGIS + MinIO │
└─────────────────────────────────────────────┘
```

## 1.5 확장성 원칙 (Multi-Task)

모든 Task는 동일 인터페이스를 구현합니다.

```python
class VisionTask(Protocol):
    task_id: str
    class_names: list[str]
    detect(frame) -> list[Detection]
    enrich(track, geo_ctx) -> RiskFeatures
```

| Task | 탐지 클래스 | Risk 특화 피처 |
|------|-------------|----------------|
| banner | banner | 허가 미일치, 게시대 이탈, 게시 만료 |
| dumping | waste_pile, bag | 수거구역 이탈, 반복 민원 |
| road_damage | pothole, crack | 도로등급, 교통량, 사고 이력 |
| child_safety | vehicle, person(+zone) | 보호구역·속도·횡단 |
| elderly_safety | person(+zone) | 노인보호구역·보행 장애물 |

**중요:** 클래스 라벨에 `illegal_*`를 쓰지 않습니다. 불법성은 Risk 엔진 출력입니다.

## 1.6 배포 토폴로지 (지자체 적용)

| 구간 | 권장 |
|------|------|
| Edge (CCTV 센터/엣지 박스) | YOLO11s TensorRT, 1–2fps, Track 로컬 |
| Center (시 서버) | Risk/Priority, PostGIS, API |
| Client | 기존 행정망 브라우저 (Next.js) |

오프라인 가능 구간(탐지·추적)과 온라인 구간(허가 DB)을 분리해 **망분리 환경**에도 대응합니다.
