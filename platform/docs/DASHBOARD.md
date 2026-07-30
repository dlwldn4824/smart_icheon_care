# 13. Dashboard 설계

기존 Next.js 앱(`/cctv`)을 Presentation 계층으로 사용하고,  
FastAPI `GET /candidates`를 연동하면 연구 파이프라인과 UI가 연결됩니다.

## 화면 구성

```text
┌──────────────────────────────────────────────────────────┐
│ 현수막 탐지·우선순위          [티어] [상태] [구역] 필터   │
├────────────────────────────┬─────────────────────────────┤
│ Leaflet/VWorld 지도         │ 우선순위 큐 (Priority DESC) │
│ · 후보 마커 (색=티어)        │ · Risk / Priority 숫자      │
│ · CCTV 위치                 │ · 처리 상태                 │
├────────────────────────────┴─────────────────────────────┤
│ 상세: 탐지 이미지 + BBox + 근거 + breakdown + 조치 버튼 │
└──────────────────────────────────────────────────────────┘
```

## 표시 필드

| 필드 | 출처 |
|------|------|
| 탐지 이미지 + BBox | detections.thumb / overlay |
| Risk / Priority | candidates |
| 시간 | detected_at |
| CCTV 번호 | camera_id |
| Track ID | track_id |
| 처리 상태 | pending / reviewing / held / resolved |
| 판단 근거 | reasons[] |

## 필터

- review_tier: 긴급/우선/일반/관찰
- status
- min_risk / min_priority
- task_id (향후 dumping 등)
- 기간, 행정동

## UX 원칙

1. **“불법” 배지 금지** → “불법 가능성 91 · 긴급 확인”
2. 최종 버튼: 확인 / 보류 / 처리 완료 / 조치 배정
3. 지도·리스트 양방향 하이라이트

## 평가 지표 패널 (연구용)

- Detection: Precision/Recall/mAP/FPS
- Tracking: IDF1/MOTA
- Decision: Top-K Precision, 평균 확인 시간, 중복 감소율

현재 프로토타입: `src/components/cctv/BannerPriorityQueue.tsx`
