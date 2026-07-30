# 라벨링 · 증강 · 학습 규칙 (MVP)

## 클래스

```yaml
names:
  0: banner
```

합법/불법은 라벨에 넣지 않습니다. 지정 게시대의 합법 현수막도 `banner`입니다.

## Bounding Box

- 현수막 **천/인쇄 영역 전체** 포함
- 끈·지지대·전봇대 제외
- 여러 현수막은 개별 박스
- 50% 이상 가려져도 식별 가능하면 라벨
- 지나치게 작은 객체(단변 &lt; 16px)는 `metadata/tiny_objects_review.csv`로 검토
- 간판·도로표지·버스광고·천막·가림막은 banner로 라벨하지 않음

## Hard Negative (빈 YOLO txt)

다음 이미지는 객체가 있어도 **빈 라벨 파일**만 둡니다.

- 상점 간판, 입간판, 버스 광고, 건물 외벽 광고
- 도로 표지판, 긴 교통 표지, 전광판
- 공사장 가림막, 천막, 선거 벽보

```bash
python scripts/make_hard_negative_labels.py \
  --input datasets/hard_negatives \
  --labels-out datasets/banner/labels/train
```

## 증강

- Ultralytics: mosaic on, mixup **off**, flipud **off**, fliplr on
- Albumentations preview: 밝기/HSV/약한 blur/비/안개/원근/부분가림
- 미리보기: `python -m training.augment --samples 20`

## 학습 기본값

`configs/banner/train.yaml` — YOLO11s, imgsz 960 (OOM 시 640 폴백), AdamW, cos_lr, amp, seed 42
