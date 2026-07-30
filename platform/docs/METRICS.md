# 14. 평가 지표

## Detection

| 지표 | 목표(초기) | 설명 |
|------|------------|------|
| Precision | ≥ 0.80 | 오탐(간판 등) 억제 |
| Recall | ≥ 0.85 | 누락 최소화 (행정 리스크) |
| F1 | ≥ 0.82 | 조화평균 |
| mAP50 | ≥ 0.85 | IoU 0.5 |
| mAP50-95 | ≥ 0.55 | 엄격 IoU |
| FPS | ≥ 실시간 여유 | 샘플러 1–2fps 기준 충분 |

측정: `python -m training.evaluate`

## Tracking

| 지표 | 의미 |
|------|------|
| IDF1 | ID 일관성 |
| MOTA | 종합 추적 정확도 |
| MOTP | 위치 정밀도 |

목표: 동일 현수막 **중복 후보 감소율 ≥ 90%**

## Decision (Risk / Priority)

| 지표 | 정의 |
|------|------|
| Top-K Precision | 상위 K 후보 중 실제 조치·위반 확인 비율 |
| Priority Accuracy | 전문가 순위와 Spearman ρ |
| Time-to-review | 탐지→담당자 확인 시간 |
| False dispatch ↓ | 불필요 출동 감소율 |

**주의:** 공모전·초기 PoC에서는 실측치가 없으면 **목표 지표**로 표기.
