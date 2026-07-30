#!/usr/bin/env bash
# Final banner model pipeline: train 30ep → finalize → verify
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[pipeline] $(date -Iseconds) start final_all_30ep training"
python -m training.train --config configs/banner/train_all_30ep.yaml 2>&1 | tee artifacts/train_all_30ep.log
echo "[pipeline] $(date -Iseconds) training finished — finalize"
python scripts/finalize_banner_model.py --device mps 2>&1 | tee -a artifacts/train_all_30ep.log
echo "[pipeline] $(date -Iseconds) verify"
python scripts/verify_demo.py --require-final 2>&1 | tee -a artifacts/train_all_30ep.log
echo "[pipeline] $(date -Iseconds) DONE"
