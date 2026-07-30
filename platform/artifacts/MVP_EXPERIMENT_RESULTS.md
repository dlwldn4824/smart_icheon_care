# Banner MVP 실험 결과 정리

작성 시점: 2026-07-27  
목적: `filtered` vs `all` 10 epoch A/B 실험 기록 (공모전 MVP 선정용)

> **주의**: 아래 val 수치는 **각 실험의 자체 val split** 기준입니다.  
> 최종 모델 선정은 두 실험이 모두 끝난 뒤 **공통 test intersection**으로  
> `scripts/compare_banner_experiments.py`를 실행한 결과만 사용하세요.  
> 스모크(800/200, 3 epoch) 수치는 발표 자료에 쓰지 마세요.

---

## 1. 실험 개요

| 항목 | filtered | all |
|------|----------|-----|
| 데이터셋 | `datasets/banner_mvp_filtered` | `datasets/banner_mvp_all` |
| 차이 | bbox w 또는 h **&lt; 8px** 제외 | tiny box 포함 |
| train / val / test | 10,960 / 1,791 / 1,892 | 11,967 / 1,961 / 2,072 |
| 모델 | YOLO11s | YOLO11s |
| epochs | 10 | 10 |
| imgsz / batch / device | 640 / 8 / MPS | 640 / 8 / MPS |
| seed | 42 | 42 |
| 설정 | `configs/banner/experiment_filtered.yaml` | `configs/banner/experiment_all.yaml` |
| 실행 이름 | `exp_mvp_filtered_10ep` | `experiment_all` |

공통 설계:
- TL2 현수막 4유형(가로/세로 × 낮/밤) 균형 샘플
- 동일 group-aware split seed
- 원본 `datasets/banner`(160k)는 보존

---

## 2. filtered 10 epoch — 완료

| 항목 | 값 |
|------|-----|
| 상태 | **완료** |
| 총 소요 | 약 **10.7시간** (38,431초) |
| best epoch | **10** (mAP50 기준) |
| 로그 | `artifacts/exp_mvp_filtered.log` |
| run dir | `runs/banner/exp_mvp_filtered_10ep/` |
| 가중치 | `weights/banner/experiment_filtered/best.pt` |
| metrics | `weights/banner/experiment_filtered/metrics.json` |

### Best (val)

| 지표 | 값 |
|------|-----|
| Precision | **0.589** |
| Recall | **0.545** |
| mAP50 | **0.521** |
| mAP50-95 | **0.317** |

### Epoch별 val 추이

| Epoch | Precision | Recall | mAP50 | mAP50-95 | 누적 시간 |
|------:|----------:|-------:|------:|---------:|----------:|
| 1 | 0.337 | 0.326 | 0.244 | 0.128 | 0.8h |
| 2 | 0.377 | 0.344 | 0.268 | 0.141 | 1.8h |
| 3 | 0.441 | 0.368 | 0.325 | 0.175 | 2.7h |
| 4 | 0.444 | 0.428 | 0.360 | 0.193 | 3.8h |
| 5 | 0.465 | 0.434 | 0.392 | 0.216 | 4.6h |
| 6 | 0.538 | 0.463 | 0.440 | 0.256 | 5.6h |
| 7 | 0.564 | 0.484 | 0.468 | 0.278 | 6.3h |
| 8 | 0.559 | 0.504 | 0.485 | 0.289 | 7.7h |
| 9 | 0.588 | 0.515 | 0.509 | 0.307 | 9.3h |
| **10** | **0.589** | **0.545** | **0.521** | **0.317** | **10.7h** |

관찰:
- epoch 전반에 걸쳐 Precision / Recall / mAP50이 **꾸준히 상승**
- ep4 시점(중간 점검): P 0.44 / R 0.43 / mAP50 0.36
- 마지막까지 과적합으로 보이는 급락은 없음 (best = last = ep10)

---

## 3. all 10 epoch — 진행 중 (작성 시점 기준)

| 항목 | 값 |
|------|-----|
| 상태 | **진행 중** (작성 시점: epoch 2 완료, epoch 3 진행) |
| 시작 | filtered 완료 직후 |
| 로그 | `artifacts/exp_mvp_all.log` |
| run dir | `runs/banner/experiment_all/` |

### 중간 val (아직 최종 아님)

| Epoch | Precision | Recall | mAP50 | mAP50-95 |
|------:|----------:|-------:|------:|---------:|
| 1 | 0.287 | 0.246 | 0.144 | 0.066 |
| 2 | 0.329 | 0.289 | 0.211 | 0.106 |

참고: tiny box를 GT에 포함하므로 **같은 epoch의 filtered val보다 낮게 나오는 것이 정상**입니다.  
최종 비교는 공통 test 기준이어야 합니다.

예상 완료: filtered와 비슷한 규모이므로 **약 10~12시간** 수준.

---

## 4. 다음 단계

```text
all 10 epoch 완료
        ↓
공통 test intersection 비교
python scripts/compare_banner_experiments.py --root .
        ↓
artifacts/experiment_comparison/comparison.md
        ↓
우수 데이터셋으로 30 epoch (yolo11s.pt부터 재학습)
        ↓
실제 CCTV 영상 추론 → 오탐 수집
```

비교 시 내부 선정 점수(공식 벤치마크 아님):

```text
score = 0.35×Recall + 0.30×Precision + 0.25×mAP50 + 0.10×mAP50-95
```

- Recall 차이 ≥ 0.05 → Recall 높은 쪽 우선  
- Precision이 0.10 이상 낮으면 공무원 검토 부담 경고  
- 차이가 1~2%p 이내면 filtered 선호 가능

30 epoch 실행 후보:

```bash
# filtered 선정 시
python -m training.train --config configs/banner/train.yaml

# all 선정 시
python -m training.train --config configs/banner/train_all_30ep.yaml
```

---

## 5. 관련 경로 요약

| 구분 | 경로 |
|------|------|
| filtered best | `weights/banner/experiment_filtered/best.pt` |
| filtered metrics | `weights/banner/experiment_filtered/metrics.json` |
| filtered results.csv | `runs/banner/exp_mvp_filtered_10ep/results.csv` |
| all 로그 | `artifacts/exp_mvp_all.log` |
| all results.csv | `runs/banner/experiment_all/results.csv` |
| 비교 스크립트 | `scripts/compare_banner_experiments.py` |
| 데이터셋 빌드 요약 | `artifacts/banner_mvp_build_summary.md` |
