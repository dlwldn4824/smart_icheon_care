# 10–12. 공공데이터 · Risk · Priority

## 10. 공공데이터 연계 (GeoSpatial Join)

### 입력 레이어

| 데이터 | 소스 예 | Join 키 |
|--------|---------|---------|
| CCTV 위치 | 시 CCTV 관리대장 | `camera_id` → Point |
| 허가 현수막 DB | 옥외광고 신고대장 | 거리 ≤ R(m) + 기간 겹침 |
| 지정 게시대 | 광고물 관리 GIS | Point-in-Polygon / 거리 |
| 어린이·노인보호구역 | 도로교통공단/지자체 | Polygon contains |
| 민원 빈도 | 시 민원 시스템 | 반경 50–100m, 최근 90일 count |
| 사고 이력 | TAAS 등 | 반경 100m, 최근 3년 |
| 보행량·인구밀도 | 생활인구/유동인구 | 격자 ID |
| 시설 중요도 | 내부 마스터 | facility_grade |

### Join 절차

```text
1) Track 대표 좌표 P = GeoMapper(bbox, camera)
2) ST_DWithin(permit_geom, P, 30m) → permit_match
3) ST_Contains(school_zone, P) → vulnerable flags
4) COUNT(complaints) WHERE ST_DWithin(..., 80m) AND ts > now()-90d
5) Feature vector → RiskEngine
```

PostGIS 예시:

```sql
SELECT c.id, COUNT(m.id) AS complaint_90d
FROM banner_candidates c
LEFT JOIN complaints m
  ON ST_DWithin(c.geom::geography, m.geom::geography, 80)
 AND m.created_at > now() - interval '90 days'
GROUP BY c.id;
```

---

## 11. Risk Score 설계

Risk는 **“현장에 나가 확인해야 할 위험·불법 가능성”** (0–100).  
Detection confidence만으로 불법 확정하지 않습니다.

### 정규화된 피처 (각 0–1)

| 피처 | 정의 | 정규화 |
|------|------|--------|
| `det_conf` | YOLO confidence | 그대로 0–1 |
| `unpermitted` | 허가 미일치 | match=0, mismatch=1, unknown=0.7 |
| `improper_loc` | 게시대 밖·전봇대 추정 | 규칙 점수 |
| `expired` | 게시 기간 만료 | 만료=1, 유효=0, 무허가=0.8 |
| `complaint_freq` | 90일 민원 | min(count/5, 1) |
| `facility_importance` | 시설 등급 | {low:0.3, mid:0.6, high:1.0} |
| `vulnerable` | 어린이/노인/교차로 등 | max(zone weights) |
| `accident_hist` | 인근 사고 | min(count/3, 1) |

### 가중치 (합=1.0)

```text
Risk =
  0.10 × det_conf
+ 0.25 × unpermitted
+ 0.15 × improper_loc
+ 0.15 × expired
+ 0.15 × complaint_freq
+ 0.10 × vulnerable
+ 0.05 × facility_importance
+ 0.05 × accident_hist
```

최종: `risk_score = round(100 × Risk)` ∈ **[0, 100]**

### 검토 티어

| Score | Tier |
|------:|------|
| ≥80 | 긴급 확인 |
| 60–79 | 우선 확인 |
| 40–59 | 일반 확인 |
| &lt;40 | 관찰 |

표현: **불법 확정 금지 → “불법 가능성/위험 후보”**

가중치 근거: 행정 판단에서 **허가·위치·기간**이 핵심이므로 합 0.55를 할당.  
탐지 confidence는 존재 신뢰일 뿐이라 0.10으로 제한.

---

## 12. Priority Score 설계

Priority는 **“제한된 인력이 지금 무엇을 먼저 할지”**.

### 피처 (0–1)

| 피처 | 정의 |
|------|------|
| `risk_norm` | risk_score / 100 |
| `travel` | 담당자 현재 위치→현장 거리 (가까울수록 높음: 1 - min(d/5000,1)) |
| `workload` | 담당자 미처리 건수 (적을수록 높음: 1 - min(n/10,1)) |
| `urgency` | 티어·민원 긴급 플래그 |
| `facility_importance` | Risk와 동일 스케일 |
| `dwell` | 설치 지속 일수 min(days/30, 1) |

### 가중치

```text
Priority =
  0.40 × risk_norm
+ 0.20 × urgency
+ 0.15 × travel
+ 0.10 × workload
+ 0.10 × facility_importance
+ 0.05 × dwell
```

`priority_score = round(100 × Priority)` ∈ **[0, 100]**  
대시보드 정렬 키: `priority_score DESC`

### Risk vs Priority

| | Risk | Priority |
|--|------|----------|
| 질문 | 얼마나 위험한/불법 가능성 높은가? | 지금 누가 먼저 갈까? |
| 거리·인력 | 미포함 | 포함 |
| 용도 | 검토 티어 | 출동 큐 |

구현: `risk/engine.py`, `priority/engine.py`
