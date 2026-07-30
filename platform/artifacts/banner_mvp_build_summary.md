# Banner MVP Dataset Build

- source: `datasets/banner` (preserved)
- seed: `42` (shared group-aware split)
- per-type sample: 4000
- filter: width < 8.0px OR height < 8.0px

## banner_mvp_all
- images train/val/test: 11967 / 1961 / 2072
- boxes: 26076

## banner_mvp_filtered
- images train/val/test: 10960 / 1791 / 1892
- boxes: 21436
- dropped boxes: 4640
- excluded images (all boxes filtered): 1357

## type × split (filtered)
- 가로현수막(낮)|test: 480
- 가로현수막(낮)|train: 2921
- 가로현수막(낮)|val: 471
- 가로현수막(밤)|test: 499
- 가로현수막(밤)|train: 2935
- 가로현수막(밤)|val: 465
- 세로현수막(낮)|test: 435
- 세로현수막(낮)|train: 2554
- 세로현수막(낮)|val: 408
- 세로현수막(밤)|test: 478
- 세로현수막(밤)|train: 2550
- 세로현수막(밤)|val: 447
