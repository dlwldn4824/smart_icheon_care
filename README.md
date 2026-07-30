# Smart Icheon Care (스마트 이천 케어)

AI 기반 도시 인프라 통합 관리 대시보드 프로토타입입니다.

## AI Municipal Vision Platform

연구·개발 수준의 CV/MLOps 코드와 설계는 [`platform/`](platform/)에 있습니다.

- **플랫폼명**: AI Municipal Vision Platform  
- **Task 1 (MVP)**: 현수막 탐지 → 공공데이터 Join → Risk → Priority  
- **확장 Task**: 무단투기, 도로파손, 어린이/노인 보호구역 위험

단일 「불법 현수막 탐지 모델」이 아니라 **2단계**로 설계합니다.

1. **CV**: YOLO11s + ByteTrack (존재·위치)
2. **행정 연계**: PostGIS Join으로 Risk/Priority 산정 → Dashboard

시작점: [`platform/README.md`](platform/README.md) · 산출물 인덱스: [`platform/docs/RESEARCH_INDEX.md`](platform/docs/RESEARCH_INDEX.md)  
요약 설계: [`docs/banner-detection-design.md`](docs/banner-detection-design.md)  
**최종 모델 카드(성능·실험·한계)**: [`platform/artifacts/BANNER_MODEL_CARD.md`](platform/artifacts/BANNER_MODEL_CARD.md)

`/cctv`에서 이미지·영상을 업로드하면 YOLO 박스 미리보기와 이벤트(Risk/Priority)가 표시됩니다. FastAPI(`:8000`) 필요.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 화면 구성

| 경로 | 설명 |
|------|------|
| `/dashboard` | 메인 대시보드 (GIS 지도, AI 리스크 카드, 시설 테이블) |
| `/parking-analysis` | 주차 갈등 분석 (히트맵, 핫스팟, 차트) |
| `/cctv` | 현수막 탐지·불법 가능성·철거 우선순위 + CCTV 모니터링 |
| `/mobile` | 시민용 앱 홈 |
| `/mobile/report` | 민원 신고 |
| `/mobile/complaints` | 내 민원 현황 |

## VWorld 지도 API 연동

이천시 실제 지도는 **국토교통부 VWorld(브이월드)** API를 사용합니다.

### API 키 발급 (무료)

1. [VWorld 회원가입](https://www.vworld.kr/v4po_main.do)
2. [오픈API → 인증키 발급](https://www.vworld.kr/dev/v4api_keyApply.do)
3. 서비스 선택: **2D지도 API** 또는 **WMTS/TMS API**
4. 도메인 등록: `http://localhost:3000` (개발), 배포 URL (운영)

### 설정

```bash
cp .env.example .env.local
```

`.env.local`에 키 입력:

```
NEXT_PUBLIC_VWORLD_API_KEY=발급받은_인증키
```

서버 재시작 후 지도 좌상단에 **VWorld API** 뱃지가 표시됩니다.

> API 키 없이도 **VWorld 데모** 타일로 이천시 지도가 표시됩니다.

## Tech Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4
- **Leaflet + VWorld** (GIS 지도)
- Recharts (차트)
- Lucide React (아이콘)

## 프로젝트 구조

```
src/
├── app/              # 페이지 라우트
├── components/       # UI 컴포넌트
│   ├── dashboard/    # 대시보드 전용
│   ├── parking/      # 주차 분석
│   ├── cctv/         # 현수막 우선순위·CCTV 모니터링
│   ├── mobile/       # 시민용 앱
│   ├── map/          # VWorld + Leaflet 지도
│   └── layout/       # AppShell
├── data/
│   ├── mock.ts                 # 목업 데이터
│   └── banner-candidates.ts    # 현수막 불법 가능성 후보
├── lib/banner-scoring.ts       # 불법 가능성·우선순위 가중합
└── types/            # TypeScript 타입
```

설계 문서: `docs/banner-detection-design.md`
