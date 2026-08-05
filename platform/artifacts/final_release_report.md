# Final Release Report

Generated: 2026-07-29T01:06:29.114402+00:00

## 1. Training

- save_dir: `platform/runs/banner/final_all_30ep`
- device: `mps`
- epochs: 30
- results.csv: `platform/weights/banner/final_all_30ep/results.csv`

## 2. Final common-test performance (30ep)

- Precision: 0.6329
- Recall: 0.5551
- F1: 0.5914
- mAP50: 0.4385
- mAP50-95: 0.2786
- Tiny Recall: 0.22023809523809523
- FP/FN: 1060/1424

## 3. vs 10ep all

See `platform/artifacts/final_model/comparison.md`

## 4. Official speed (use this, not eval-loop FPS)

- Source: `platform/artifacts/final_model/speed_benchmark.json` (n=20 single-image)
- MPS ≈ 15.7 FPS (~63.5 ms) · CPU ≈ 4.2 FPS (~238.5 ms)
- Note: `comparison.md` eval-loop fps (e.g. 38.3) is **not** the portfolio figure.

## 5–10. See also

- comparison: `platform/artifacts/final_model/comparison.md`
- demo: `platform/artifacts/final_model/demo_results.json`
- release: `platform/weights/banner/release`
- onnx: {"ok": false, "path": null, "error": "No module named 'onnx'", "test_ok": false}
