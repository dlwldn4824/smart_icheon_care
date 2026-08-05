# Final Model Comparison (10ep all vs 30ep final)

- Common test images: 1892
- Generated: 2026-07-29T01:06:16.003729+00:00

| metric | 10ep all | 30ep final | delta |
|---|---:|---:|---:|
| precision | 0.5938 | 0.6329 | +3.92%p |
| recall | 0.5286 | 0.5551 | +2.65%p |
| f1 | 0.5593 | 0.5914 | +3.217%p |
| map50 | 0.4088 | 0.4385 | +2.97%p |
| map50_95 | 0.2603 | 0.2786 | +1.83%p |
| tiny_recall | 0.1935 | 0.2202 | +2.68%p |
| fp | 1029 | 1060 |  |
| fn | 1551 | 1424 |  |
| infer_ms (eval loop) | 133.00 | 26.11 | *조건 상이 — 아래 참고* |
| fps (eval loop) | 7.52 | 38.30 | *조건 상이 — 아래 참고* |

### 속도 수치 읽는 법

| 출처 | 조건 | 권장 인용 |
|------|------|-----------|
| **`speed_benchmark.json`** | 단일 이미지 반복 n=20, 전용 벤치 | **MPS ~15.7 FPS · CPU ~4.2 FPS** ← 이력서/README |
| 위 표 `fps` / `infer_ms` | Ultralytics 공통테스트 **평가 루프** 타이밍 (세션·캐시·배치 영향) | 비교 실험 로그용. 10ep↔30ep 절대 속도 비교에 쓰지 말 것 |

포트폴리오 공식 속도: `artifacts/final_model/speed_benchmark.json` · 모델카드 §4.3.
