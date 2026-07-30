#!/usr/bin/env python3
"""
Scan AI Hub label ZIPs (TLn / VLn) for category_name counts WITHOUT full extract.
Find which package numbers contain street-banner classes before downloading TSn/VSn.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

BANNER_TOKENS = (
    "가로현수막",
    "세로현수막",
    "불법현수막",
    "불법 현수막",
    "현수막",
    "banner",
    "horizontal banner",
    "vertical banner",
)
XBANNER_TOKEN = "엑스배너"

PKG_RE = re.compile(r"^(TL|VL|TS|VS)(\d+)", re.I)


def normalize_name(name: str) -> str:
    s = (name or "").strip()
    s = re.sub(r"\s+", " ", s)
    return s.casefold()


def classify_label(name: str) -> str:
    """Return banner | xbanner | other."""
    n = normalize_name(name)
    if XBANNER_TOKEN in name or normalize_name(XBANNER_TOKEN) in n:
        return "xbanner"
    # street banners — 현수막 but not 엑스배너
    if any(normalize_name(t) in n for t in ("가로현수막", "세로현수막", "불법현수막", "불법 현수막")):
        return "banner"
    if "현수막" in name or "banner" in n:
        return "banner"
    return "other"


def package_id(path: Path) -> str | None:
    m = PKG_RE.match(path.name)
    if not m:
        return None
    return f"{m.group(1).upper()}{m.group(2)}"


def corresponding_source(pkg: str) -> str | None:
    m = PKG_RE.match(pkg)
    if not m:
        return None
    kind, num = m.group(1).upper(), m.group(2)
    if kind == "TL":
        return f"TS{num}.zip"
    if kind == "VL":
        return f"VS{num}.zip"
    return None


def discover_label_zips(root: Path) -> list[Path]:
    """Unique TL*/VL* zip-like files (prefer .part0 / assembled .zip)."""
    candidates: list[Path] = []
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        name = p.name
        if not (name.startswith("TL") or name.startswith("VL")):
            continue
        if ".zip" not in name:
            continue
        # skip mid parts of split archives
        if ".part" in name and not name.endswith(".part0"):
            continue
        candidates.append(p)

    # dedupe by package id + size (keep shortest path)
    best: dict[tuple[str, int], Path] = {}
    for p in candidates:
        pkg = package_id(p)
        if not pkg:
            continue
        key = (pkg, p.stat().st_size)
        prev = best.get(key)
        if prev is None or len(str(p)) < len(str(prev)):
            best[key] = p
    # one file per package (largest size wins if multiple variants)
    by_pkg: dict[str, Path] = {}
    for (pkg, size), p in best.items():
        cur = by_pkg.get(pkg)
        if cur is None or p.stat().st_size > cur.stat().st_size:
            by_pkg[pkg] = p
    return [by_pkg[k] for k in sorted(by_pkg.keys(), key=lambda x: (x[:2], int(x[2:])))]


def scan_zip(zip_path: Path) -> dict:
    pkg = package_id(zip_path) or zip_path.name
    cat_boxes: Counter = Counter()  # (id, original_name) -> box count
    cat_images: dict[tuple[int | str, str], set[str]] = defaultdict(set)
    banner_examples: dict[str, list[str]] = defaultdict(list)
    json_count = 0
    bad_json = 0

    with zipfile.ZipFile(zip_path) as z:
        members = [n for n in z.namelist() if n.endswith(".json")]
        json_count = len(members)
        for name in members:
            try:
                data = json.loads(z.read(name))
            except Exception:
                bad_json += 1
                continue
            bbox = (data.get("annotations") or {}).get("Bbox Annotation")
            if not isinstance(bbox, dict):
                continue
            file_name = bbox.get("atchFileName") or Path(name).name
            for box in bbox.get("Box") or []:
                cname = str(box.get("category_name", ""))
                cid = box.get("category_id", "")
                key = (cid, cname)
                cat_boxes[key] += 1
                cat_images[key].add(file_name)
                kind = classify_label(cname)
                if kind == "banner" and len(banner_examples[cname]) < 5:
                    banner_examples[cname].append(name)

    rows = []
    for (cid, cname), count in sorted(cat_boxes.items(), key=lambda x: (-x[1], str(x[0][1]))):
        rows.append(
            {
                "package": pkg,
                "zip_file": zip_path.name,
                "zip_path": str(zip_path),
                "json_files": json_count,
                "category_id": cid,
                "category_name": cname,
                "category_name_norm": normalize_name(cname),
                "label_kind": classify_label(cname),
                "box_count": count,
                "image_count": len(cat_images[(cid, cname)]),
                "corresponding_source": corresponding_source(pkg) or "",
            }
        )

    return {
        "package": pkg,
        "zip_path": zip_path,
        "json_count": json_count,
        "bad_json": bad_json,
        "rows": rows,
        "banner_examples": dict(banner_examples),
    }


def write_markdown(results: list[dict], path: Path) -> None:
    lines = [
        "# AI Hub 라벨 ZIP 카테고리 인덱스",
        "",
        "대용량 원천(TS/VS) 다운로드 전에 **라벨 ZIP만** 스캔한 결과입니다.",
        "",
        "## 패키지 요약",
        "",
        "| Package | ZIP | JSON 수 | 고유 클래스 수 | banner 박스 | xbanner 박스 | 대응 원천 |",
        "|---------|-----|--------:|---------------:|------------:|-------------:|-----------|",
    ]
    banner_pkgs: list[str] = []
    for r in results:
        rows = r["rows"]
        banner_boxes = sum(x["box_count"] for x in rows if x["label_kind"] == "banner")
        xbanner_boxes = sum(x["box_count"] for x in rows if x["label_kind"] == "xbanner")
        n_cls = len(rows)
        src = corresponding_source(r["package"]) or "-"
        lines.append(
            f"| {r['package']} | `{r['zip_path'].name}` | {r['json_count']} | {n_cls} | "
            f"{banner_boxes} | {xbanner_boxes} | `{src}` |"
        )
        if banner_boxes > 0:
            banner_pkgs.append(r["package"])

    lines += ["", "## 현수막(banner) 상세", ""]
    if not banner_pkgs:
        lines.append("**아직 가로/세로/불법 현수막 클래스가 어떤 라벨 ZIP에서도 발견되지 않았습니다.**")
        lines.append("")
        lines.append("검사되지 않은 VL/TL이 남아 있으면 추가 스캔 전까지 TS/VS를 받지 마세요.")
    else:
        for r in results:
            banner_rows = [x for x in r["rows"] if x["label_kind"] == "banner"]
            if not banner_rows:
                continue
            src = corresponding_source(r["package"])
            lines.append(f"### {r['package']} → 원천 `{src}`")
            lines.append("")
            lines.append("| category_id | category_name | boxes | images |")
            lines.append("|------------:|---------------|------:|-------:|")
            for x in banner_rows:
                lines.append(
                    f"| {x['category_id']} | {x['category_name']} | {x['box_count']} | {x['image_count']} |"
                )
            examples = r.get("banner_examples") or {}
            if examples:
                lines.append("")
                lines.append("JSON 예시:")
                for cname, paths in examples.items():
                    lines.append(f"- **{cname}**")
                    for p in paths:
                        lines.append(f"  - `{p}`")
            lines.append("")

    lines += [
        "## 다운로드 지침",
        "",
        "- **받을 것**: 위 banner 상세에 나온 `TLn`/`VLn`에 대응하는 `TSn`/`VSn`만",
        "- **받지 말 것**: banner 박스가 0인 패키지의 대용량 원천 ZIP",
        "- 엑스배너는 banner 학습 대상에서 제외 (별도 집계만)",
        "",
        "## 전체 클래스 (ZIP별)",
        "",
    ]
    for r in results:
        lines.append(f"### {r['package']}")
        lines.append("")
        lines.append("| category_id | category_name | kind | boxes | images |")
        lines.append("|------------:|---------------|------|------:|-------:|")
        for x in r["rows"]:
            lines.append(
                f"| {x['category_id']} | {x['category_name']} | {x['label_kind']} | "
                f"{x['box_count']} | {x['image_count']} |"
            )
        lines.append("")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="datasets/raw/aihub_banner")
    parser.add_argument("--output", default="artifacts/aihub_category_counts.csv")
    parser.add_argument(
        "--markdown",
        default="docs/AIHUB_CATEGORY_INDEX.md",
        help="Markdown report path",
    )
    args = parser.parse_args()

    root = Path(args.input)
    if not root.exists():
        raise SystemExit(f"[scan] input not found: {root.resolve()}")

    zips = discover_label_zips(root)
    if not zips:
        raise SystemExit(
            f"[scan] no TL*/VL* zip found under {root}\n"
            "Place TL2~TL5, VL1~VL5 (.zip or .zip.part0) first."
        )

    print(f"[scan] found {len(zips)} label package(s):")
    for z in zips:
        print(f"  - {package_id(z)}: {z} ({z.stat().st_size/1e6:.1f} MB)")

    results = []
    all_rows = []
    for z in zips:
        print(f"[scan] scanning {package_id(z)} ...")
        info = scan_zip(z)
        results.append(info)
        all_rows.extend(info["rows"])
        banner = [r for r in info["rows"] if r["label_kind"] == "banner"]
        xb = [r for r in info["rows"] if r["label_kind"] == "xbanner"]
        print(
            f"  json={info['json_count']} classes={len(info['rows'])} "
            f"banner_boxes={sum(r['box_count'] for r in banner)} "
            f"xbanner_boxes={sum(r['box_count'] for r in xb)}"
        )

    out_csv = Path(args.output)
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "package",
        "zip_file",
        "zip_path",
        "json_files",
        "category_id",
        "category_name",
        "category_name_norm",
        "label_kind",
        "box_count",
        "image_count",
        "corresponding_source",
    ]
    with open(out_csv, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for row in all_rows:
            w.writerow({k: row.get(k, "") for k in fields})

    md_path = Path(args.markdown)
    write_markdown(results, md_path)

    # Final recommendation block
    print("\n======== FINAL ========")
    train_hits = []
    val_hits = []
    for r in results:
        banner_rows = [x for x in r["rows"] if x["label_kind"] == "banner"]
        if not banner_rows:
            continue
        detail = ", ".join(f"{x['category_name']} {x['box_count']:,}개" for x in banner_rows)
        src = corresponding_source(r["package"])
        line = f"- {r['package']}: {detail}\n  다운로드할 원천데이터: {src}"
        if r["package"].startswith("TL"):
            train_hits.append(line)
        else:
            val_hits.append(line)

    print("\nTraining 현수막 패키지:")
    if train_hits:
        print("\n".join(train_hits))
    else:
        print("- (아직 없음 — 스캔된 TL에 가로/세로 현수막 없음)")
        print("- 대용량 TS 원천데이터 다운로드하지 마세요")

    print("\nValidation 현수막 패키지:")
    if val_hits:
        print("\n".join(val_hits))
    else:
        missing_vl = [f"VL{i}" for i in range(1, 6) if not any(x["package"] == f"VL{i}" for x in results)]
        print("- (아직 없음)")
        if missing_vl:
            print(f"- 미수신 라벨: {', '.join(missing_vl)} — 먼저 라벨만 받아 재스캔")
        print("- 대용량 VS 원천데이터 다운로드하지 마세요")

    scanned = {r["package"] for r in results}
    print("\n스캔 완료 패키지:", ", ".join(sorted(scanned)))
    print(f"CSV: {out_csv.resolve()}")
    print(f"MD:  {md_path.resolve()}")


if __name__ == "__main__":
    main()
