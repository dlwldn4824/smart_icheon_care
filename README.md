# Smart Icheon Care (스마트 이천 케어)

AI 기반 도시 인프라 통합 관리 대시보드 프로토타입입니다.

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
| `/cctv` | AI CCTV 모니터링 (실시간 탐지, 이력, 분석) |
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
│   ├── cctv/         # CCTV 모니터링
│   ├── mobile/       # 시민용 앱
│   ├── map/          # VWorld + Leaflet 지도
│   └── layout/       # AppShell
├── data/mock.ts      # 목업 데이터
└── types/            # TypeScript 타입
```
