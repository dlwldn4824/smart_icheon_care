import fs from "node:fs";
import path from "node:path";
import iconv from "iconv-lite";
import type {
  IcheonPublicData,
  ParkRecord,
  ParkingLotRecord,
  ProtectionZoneRecord,
} from "../src/types/public-data";
import { computeParkingShortageZones } from "../src/lib/shortage-zones";

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "공공데이터");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");
const OUT_FILE = path.join(OUT_DIR, "icheon.json");

const ICHEON_LAT = { min: 37.0, max: 37.5 };
const ICHEON_LNG = { min: 127.0, max: 127.7 };

function isIcheonAddress(address: string): boolean {
  return address.includes("이천시") || address.includes("경기 이천");
}

function parseCoord(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const n = Number.parseFloat(value.trim());
  return Number.isFinite(n) ? n : null;
}

function isValidIcheonCoord(lat: number, lng: number): boolean {
  return (
    lat >= ICHEON_LAT.min &&
    lat <= ICHEON_LAT.max &&
    lng >= ICHEON_LNG.min &&
    lng <= ICHEON_LNG.max
  );
}

function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && next === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0];
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header.trim()] = (cells[idx] ?? "").trim();
    });
    return record;
  });
}

function readCsvFile(filename: string, encoding: "utf-8" | "cp949"): Record<string, string>[] {
  const filePath = path.join(DATA_DIR, filename);
  const buffer = fs.readFileSync(filePath);
  const content =
    encoding === "cp949"
      ? iconv.decode(buffer, "cp949")
      : buffer.toString("utf-8").replace(/^\uFEFF/, "");
  return parseCsv(content);
}

const REQUIRED_CSV = [
  "경기도_이천시_어린이보호구역_20260122.csv",
  "경기도_이천시_노인장애인보호구역_20260522.csv",
  "전국주차장정보표준데이터.csv",
  "전국도시공원정보표준데이터.csv",
] as const;

function hasSourceCsvFiles(): boolean {
  if (!fs.existsSync(DATA_DIR)) return false;
  return REQUIRED_CSV.every((name) => fs.existsSync(path.join(DATA_DIR, name)));
}

function dedupeKey(name: string, lat: number, lng: number): string {
  return `${name}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
}

function loadChildProtectionZones(): ProtectionZoneRecord[] {
  const rows = readCsvFile("경기도_이천시_어린이보호구역_20260122.csv", "utf-8");
  const seen = new Set<string>();
  const result: ProtectionZoneRecord[] = [];

  for (const row of rows) {
    const lat = parseCoord(row["위도"]);
    const lng = parseCoord(row["경도"]);
    const name = row["대상시설명"];
    if (!name || lat === null || lng === null || !isValidIcheonCoord(lat, lng)) continue;

    const key = dedupeKey(name, lat, lng);
    if (seen.has(key)) continue;
    seen.add(key);

    const roadWidth = parseCoord(row["보호구역도로폭"]);

    result.push({
      id: `child-${result.length + 1}`,
      name,
      subtype: "child",
      facilityType: row["시설종류"] || "기타",
      lat,
      lng,
      roadWidth,
      address: row["소재지도로명주소"] || row["소재지지번주소"] || "",
    });
  }

  return result;
}

function loadElderlyProtectionZones(): ProtectionZoneRecord[] {
  const rows = readCsvFile("경기도_이천시_노인장애인보호구역_20260522.csv", "utf-8");
  const seen = new Set<string>();
  const result: ProtectionZoneRecord[] = [];

  for (const row of rows) {
    const lat = parseCoord(row["위도"]);
    const lng = parseCoord(row["경도"]);
    const name = row["대상시설명"];
    if (!name || lat === null || lng === null || !isValidIcheonCoord(lat, lng)) continue;

    const key = dedupeKey(name, lat, lng);
    if (seen.has(key)) continue;
    seen.add(key);

    const roadWidth = parseCoord(row["보호구역도로폭"]);

    result.push({
      id: `elderly-${result.length + 1}`,
      name,
      subtype: "elderly",
      facilityType: row["장소유형코드"] || "기타",
      lat,
      lng,
      roadWidth,
      address: row["소재지도로명주소"] || row["소재지지번주소"] || "",
    });
  }

  return result;
}

function loadParkingLots(): ParkingLotRecord[] {
  const rows = readCsvFile("전국주차장정보표준데이터.csv", "cp949");
  const seen = new Set<string>();
  const result: ParkingLotRecord[] = [];

  for (const row of rows) {
    const address = `${row["소재지도로명주소"] || ""}${row["소재지지번주소"] || ""}`;
    if (!isIcheonAddress(address)) continue;

    const lat = parseCoord(row["위도"]);
    const lng = parseCoord(row["경도"]);
    const name = row["주차장명"];
    if (!name || lat === null || lng === null || !isValidIcheonCoord(lat, lng)) continue;

    const key = dedupeKey(name, lat, lng);
    if (seen.has(key)) continue;
    seen.add(key);

    const spaces = Number.parseInt(row["주차구획수"] || "0", 10);

    result.push({
      id: `parking-${result.length + 1}`,
      name,
      lat,
      lng,
      spaces: Number.isFinite(spaces) ? spaces : 0,
      type: row["주차장구분"] || row["주차장유형"] || "기타",
      address: row["소재지도로명주소"] || row["소재지지번주소"] || "",
    });
  }

  return result;
}

function loadParks(): ParkRecord[] {
  const rows = readCsvFile("전국도시공원정보표준데이터.csv", "cp949");
  const seen = new Set<string>();
  const result: ParkRecord[] = [];

  for (const row of rows) {
    const address = `${row["소재지도로명주소"] || ""}${row["소재지지번주소"] || ""}`;
    if (!isIcheonAddress(address)) continue;

    const lat = parseCoord(row["위도"]);
    const lng = parseCoord(row["경도"]);
    const name = row["공원명"];
    if (!name || lat === null || lng === null || !isValidIcheonCoord(lat, lng)) continue;

    const key = dedupeKey(name, lat, lng);
    if (seen.has(key)) continue;
    seen.add(key);

    const area = parseCoord(row["공원면적"]);

    result.push({
      id: `park-${result.length + 1}`,
      name,
      lat,
      lng,
      category: row["공원구분"] || "공원",
      area,
      address: row["소재지도로명주소"] || row["소재지지번주소"] || "",
    });
  }

  return result;
}

function main() {
  if (!hasSourceCsvFiles()) {
    if (fs.existsSync(OUT_FILE)) {
      console.log(
        "Skip public data build: 공공데이터 CSV 없음 — 기존 generated/icheon.json 사용 (Vercel/CI 배포용)",
      );
      return;
    }
    console.error(
      "공공데이터 CSV가 없고 generated/icheon.json도 없습니다.\n" +
        "로컬에서 CSV를 공공데이터/에 넣고 npm run build:data 를 실행하세요.",
    );
    process.exit(1);
  }

  const childZones = loadChildProtectionZones();
  const elderlyZones = loadElderlyProtectionZones();
  const parkingLots = loadParkingLots();
  const parks = loadParks();

  const protectionZones = [...childZones, ...elderlyZones];

  const base: Omit<IcheonPublicData, "shortageZones"> = {
    meta: {
      generatedAt: new Date().toISOString(),
      sources: [
        "경기도_이천시_어린이보호구역_20260122.csv",
        "경기도_이천시_노인장애인보호구역_20260522.csv",
        "전국주차장정보표준데이터.csv",
        "전국도시공원정보표준데이터.csv",
      ],
      counts: {
        protectionZones: protectionZones.length,
        parkingLots: parkingLots.length,
        parks: parks.length,
      },
    },
    protectionZones,
    parkingLots,
    parks,
  };

  const output: IcheonPublicData = {
    ...base,
    shortageZones: computeParkingShortageZones(base),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf-8");

  console.log("Generated:", OUT_FILE);
  console.log("Counts:", output.meta.counts);
}

main();
