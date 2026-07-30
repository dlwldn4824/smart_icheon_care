# Banner Dataset Report

Class: `banner` (id=0). Illegal/legal is NOT a detection label.

## Split summary

| split | images | boxes | empty_labels |
|-------|-------:|------:|-------------:|
| train | 111,945 | 194,860 | 0 |
| val | 31,438 | 53,281 | 0 |
| test | 16,617 | 27,944 | 0 |

## Filename-prefix type counts (approx)

- **가로현수막(낮)**: 40,000
- **가로현수막(밤)**: 40,000
- **세로현수막(낮)**: 40,000
- **세로현수막(밤)**: 40,000

## Visual QA previews

Check that green boxes hug the banner (not shifted to 1920×1080 meta resolution).

Preview dir: `artifacts/banner_dataset_report/previews`

### 가로현수막(낮)
- `previews/horizontal_day/00_train_9_20210703_10116-0-0600.jpg` (train, boxes=2)
- `previews/horizontal_day/01_val_9_20210721_10569-0-1300.jpg` (val, boxes=1)
- `previews/horizontal_day/02_train_9_20210803_6731-0-0600.jpg` (train, boxes=5)
- `previews/horizontal_day/03_train_9_20210705_11014-0-1300.jpg` (train, boxes=3)
- `previews/horizontal_day/04_train_9_20210726_12767-0-0600.jpg` (train, boxes=1)
- `previews/horizontal_day/05_train_9_20210709_9743-0-1300.jpg` (train, boxes=3)
- `previews/horizontal_day/06_val_9_20210719_10186-0-1300.jpg` (val, boxes=3)
- `previews/horizontal_day/07_train_9_20210802_7585-0-1000.jpg` (train, boxes=2)

### 가로현수막(밤)
- `previews/horizontal_night/00_test_10_20210729_15049-0-2200.jpg` (test, boxes=1)
- `previews/horizontal_night/01_val_10_20210703_7250-0-2200.jpg` (val, boxes=1)
- `previews/horizontal_night/02_train_10_20210805_10767-0-2200.jpg` (train, boxes=6)
- `previews/horizontal_night/03_val_10_20210715_8103-0-2000.jpg` (val, boxes=2)
- `previews/horizontal_night/04_train_10_20210801_8426-0-2000.jpg` (train, boxes=1)
- `previews/horizontal_night/05_val_10_20210704_13277-0-2200.jpg` (val, boxes=2)
- `previews/horizontal_night/06_train_10_20210727_10072-0-2200.jpg` (train, boxes=4)
- `previews/horizontal_night/07_train_10_20210806_7801-0-2000.jpg` (train, boxes=1)

### 세로현수막(낮)
- `previews/vertical_day/00_train_11_20210806_13271-0-1000.jpg` (train, boxes=4)
- `previews/vertical_day/01_train_11_20211111_13835-0-1400.jpg` (train, boxes=7)
- `previews/vertical_day/02_train_11_20211107_13963-0-1500.jpg` (train, boxes=5)
- `previews/vertical_day/03_train_11_20210809_7499-0-1300.jpg` (train, boxes=6)
- `previews/vertical_day/04_val_11_20211012_8985-0-1500.jpg` (val, boxes=1)
- `previews/vertical_day/05_train_11_20210724_13591-0-1300.jpg` (train, boxes=10)
- `previews/vertical_day/06_test_11_20211114_14084-0-0700.jpg` (test, boxes=2)
- `previews/vertical_day/07_train_11_20210707_7303-0-0600.jpg` (train, boxes=1)

### 세로현수막(밤)
- `previews/vertical_night/00_train_12_20210731_10379-0-2200.jpg` (train, boxes=2)
- `previews/vertical_night/01_train_12_20211108_6521-0-2300.jpg` (train, boxes=1)
- `previews/vertical_night/02_train_12_20210715_8749-0-2200.jpg` (train, boxes=3)
- `previews/vertical_night/03_train_12_20211013_12651-0-0100.jpg` (train, boxes=2)
- `previews/vertical_night/04_train_12_20210729_14634-0-0200.jpg` (train, boxes=1)
- `previews/vertical_night/05_train_12_20210723_7083-0-2200.jpg` (train, boxes=1)
- `previews/vertical_night/06_val_12_20211108_9087-0-2100.jpg` (val, boxes=1)
- `previews/vertical_night/07_train_12_20211110_8541-0-0300.jpg` (train, boxes=2)

## Note on val/test

Current val/test are **internal splits of TL2** (group-wise). When VL2/VS2 are confirmed as banner validation packages, use them as an external hold-out.
