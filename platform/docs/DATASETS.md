# 데이터셋 조사 · 채택 기록 (실측/공식 링크 기준)

자동 다운로드를 수행하지 않습니다. AI Hub는 로그인·약관 동의가 필요합니다.

## 추천 순위 (MVP)

| 순위 | 데이터셋 | 채택 |
|------|----------|------|
| 1 | AI Hub 종합 민원 이미지 AI데이터 (dataSetSn=492) | **주학습 채택 (수동 배치)** |
| 2 | Roboflow Universe `banner-iw81k` (CC BY 4.0 표기) | 보조 후보 (페이지에서 라이선스 재확인 후) |
| 3 | 이천시 직접 수집 CCTV 프레임 | 도메인 적응 (내부) |
| 4 | AI Hub 공원 불법행위/객체 (dataSetSn=477) | Task2 확장 시 |

---

## 1) AI Hub — 종합 민원 이미지 AI데이터 ★ 채택

| 항목 | 내용 |
|------|------|
| 명칭 | 종합 민원 이미지 AI데이터 |
| 제공기관 | AI Hub / NIA |
| 공식 URL | https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=492 |
| 이미지 수 | 데이터셋 소개상 현수막 관련 항목(가로/세로×주/야) 비중 약 20%로 안내됨. **실제 다운로드 파일 수는 로컬 inspect로 확인** |
| 현수막 클래스 | 있음 (가로현수막·세로현수막 등) |
| 라벨 형식 | 다운로드 패키지 기준 JSON/이미지 (변환 스크립트 제공) |
| 라이선스 | AI Hub 이용정책 (학습용, 재배포·국외반출 제한, 출처 명시) https://aihub.or.kr/intrcn/guid/usagepolicy.do |
| 상업적 이용 | 데이터 재배포/양도 금지. 학습 모델 활용은 정책·출처 고지 조건 확인 필요 |
| 연구·공모전 | 가능 (이용약관·출처 표기 준수) |
| 다운로드 | 웹 로그인 후 수동 |
| 배치 경로 | `datasets/raw/aihub_banner/` |
| 채택 | **예** |
| 변환 | `python scripts/convert_aihub_to_yolo.py --input datasets/raw/aihub_banner --output datasets/banner/all` |

---

## 2) AI Hub — 공원 주요시설 및 불법행위 감시

| 항목 | 내용 |
|------|------|
| 명칭 | 공원 주요시설 및 불법행위 감시 데이터 |
| 공식 URL | https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=477 |
| 현수막 | 불법객체·현수막부착 항목 포함 (소개 페이지 기준) |
| 라이선스 | AI Hub 이용정책 |
| 채택 | MVP 주데이터는 아님. Task2(무단투기) 확장 시 재검토 |
| 제외 사유(MVP) | 도로 CCTV 도메인과 공원 연출 도메인 갭 |

---

## 3) Roboflow Universe — banner (illegalbannerdetection/banner-iw81k)

| 항목 | 내용 |
|------|------|
| 명칭 | banner Dataset |
| 제공 | Roboflow Universe 사용자 프로젝트 |
| 공식 URL | https://universe.roboflow.com/illegalbannerdetection/banner-iw81k |
| 이미지 수 | Universe 페이지 표기 기준 약 5k (방문 시점마다 달라질 수 있음 → Export 시 확인) |
| 클래스 | banner 계열 1클래스 표기 |
| 라벨 | Roboflow YOLO/COCO export |
| 라이선스 | 페이지 Cite 섹션에 **CC BY 4.0** 표기 (사용 전 재확인 필수) |
| 상업적 이용 | CC BY 4.0 조건(저작자 표시) 하 가능하나, 원본 이미지 개별 권리 이슈 가능 → 법무/공모전 규정 확인 |
| 채택 | **조건부 보조**. Export 후 `convert_coco_to_yolo.py` 사용 |
| 제외 가능 사유 | Cloudflare/로그인·Export 제한, CCTV 도메인 불일치 |

---

## 4) 직접 수집

| 항목 | 내용 |
|------|------|
| 명칭 | 이천시 CCTV/현장 촬영 |
| 라이선스 | 시 소유, 개인정보 비식별 필수 |
| 채택 | 도메인 적응용으로 권장 |
| 배치 | `datasets/raw/icheon_capture/` (생성 후 동일 변환 파이프라인)

---

## Hard Negative

간판·버스광고·표지판·천막·가림막·전광판 등은 **banner로 라벨하지 않음**.  
빈 라벨 생성: `python scripts/make_hard_negative_labels.py --input datasets/hard_negatives --labels-out ...`

## 디렉터리

```text
datasets/banner/
  images/{train,val,test}
  labels/{train,val,test}
  metadata/
  data.yaml
datasets/raw/aihub_banner/   # 수동 배치
datasets/public_data/        # sample 행정 데이터 (고정값)
```
