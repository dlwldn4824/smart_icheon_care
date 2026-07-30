# Final Model Comparison (10ep all vs 30ep final)

- Common test images: 1892
- Generated: 2026-07-29T01:06:16.003729+00:00

| metric | 10ep all | 30ep final | delta |
|---|---:|---:|---:|
| precision | 0.5938 | 0.6329 | +3.92% |
| recall | 0.5286 | 0.5551 | +2.65% |
| f1 | 0.5593 | 0.5914 | +3.22% |
| map50 | 0.4088 | 0.4385 | +2.97% |
| map50_95 | 0.2603 | 0.2786 | +1.83% |
| tiny_recall | 0.1935 | 0.2202 | +2.68% |
| fp | 1029 | 1060 |  |
| fn | 1551 | 1424 |  |
| infer_ms | 133.00 | 26.11 |  |
| fps | 7.52 | 38.30 |  |
