# 2. 모델 선정

## 2.1 결론 (MVP 추천)

| 항목 | 선택 |
|------|------|
| **권장 모델** | **YOLO11s** |
| 대안 (연구) | YOLO12s — 정확도↑ / 학습 불안정·CPU 느림 |
| 대안 (엣지·2026) | YOLO26s — NMS-free, CPU/엣지 유리 (파이프라인 검증 후 이관) |

**이유 요약**

1. **실시간 CCTV**: T4 TensorRT 기준 s급은 수 ms대, 1–2fps 샘플링과 여유
2. **지자체 운영**: 학습 안정성·문서·생태계가 YOLO11이 성숙
3. **경량화**: n은 소형·원거리 현수막 Recall 부족 위험, m은 엣지 부담
4. **Ultralytics 공식 입장**: YOLO12는 attention으로 메모리·학습 불안정·CPU 저하 → **프로덕션 비권장**
5. **확장성**: 동일 Ultralytics API로 Task 2–5 가중치만 교체

근거: [Ultralytics Model Comparisons](https://docs.ultralytics.com/compare), [YOLO12 docs](https://docs.ultralytics.com/models/yolo12)

## 2.2 요구사항 매핑

| 요구 | YOLO11s 적합성 |
|------|----------------|
| 속도 | 실시간 모니터링에 충분 (샘플링 1–2fps) |
| mAP | COCO ~47.0 mAP50-95 — 전이학습 후 현수막에 재튜닝 |
| 실시간성 | GPU 서버·엣지 박스 모두 가능 |
| 경량화 | ~9.4M params, TensorRT/ONNX export |
| Edge | Jetson Orin / 시 서버 GPU 권장; n급은 초경량 데모용 |

## 2.3 스케일 비교 (YOLO11, COCO val 참고치)

| 모델 | mAP50-95 | params | 용도 |
|------|----------|--------|------|
| **YOLO11n** | ~39.5 | ~2.6M | 데모·초저사양, 소형 현수막 Recall↓ 위험 |
| **YOLO11s** ★ | ~47.0 | ~9.4M | **MVP·현장 PoC 기본** |
| **YOLO11m** | ~51.5 | ~20.1M | 센터 GPU 정확도 우선, 배치 추론 |

## 2.4 YOLO11 vs YOLO12 vs YOLO26

| 항목 | YOLO11 | YOLO12 | YOLO26 |
|------|--------|--------|--------|
| 프로덕션 권장 | ✅ 안정 | ❌ Ultralytics 비권장 | ✅ 신규 SOTA (검증 후) |
| 특징 | 균형·생태계 | Attention, mAP↑ | NMS-free, CPU↑ |
| 리스크 | 낮음 | 학습 불안정·메모리 | 신규 API/벤치 재검증 |
| MVP 선택 | **채택** | 연구 벤치만 | Phase-2 엣지 최적화 |

## 2.5 Edge Device 전략

```text
개발/학습: A100/T4 + YOLO11s FP16
시범 운영: 시 서버 GPU + TensorRT
확산: Jetson Orin NX + YOLO11n/s INT8 (캘리브레이션 후)
향후: YOLO26s로 엣지 CPU 경로 실험
```

## 2.6 선정 선언문 (발표용)

> MVP 탐지 백본으로 **YOLO11s**를 채택한다.  
> 현수막은 원거리·가림·야간이 많아 n급은 Recall 위험이 있고, m급은 엣지 확산 비용이 크다.  
> YOLO12는 연구 벤치마크용으로만 두고, 운영 파이프라인은 안정성이 검증된 YOLO11s로 고정한다.
