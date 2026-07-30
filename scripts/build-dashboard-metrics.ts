import fs from "node:fs";
import path from "node:path";
import type { IcheonPublicData } from "../src/types/public-data";
import type { DashboardMetrics } from "../src/types/dashboard-metrics";
import { getParkingShortageZoneCount } from "../src/lib/parking-shortage";

const ROOT = path.resolve(__dirname, "..");
const ICHEON_FILE = path.join(ROOT, "src", "data", "generated", "icheon.json");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");
const OUT_FILE = path.join(OUT_DIR, "dashboard-metrics.json");

/** 운영 mock 기준값 — CCTV 피드·민원·제설 구간 수 */
const OPERATIONAL = {
  activeCctvFeeds: 4,
  complaintsLast30d: { banner: 18, facility: 24, snow: 12, parking: 15 },
  snowRoutes: { total: 50, current: 32 },
};

const WEEK_LABELS = ["4월1주", "4월2주", "4월3주", "4월4주", "5월1주", "5월2주", "5월3주", "5월4주", "6월1주", "6월2주", "6월3주", "6월4주"];

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function weeklyValue(base: number, weekIndex: number, volatility: number): number {
  const wave = Math.sin((weekIndex / 12) * Math.PI * 1.7) * 0.1;
  const wave2 = Math.cos((weekIndex / 12) * Math.PI * 2.3) * 0.06;
  const noise = (hash01(base * 19 + weekIndex * 37) - 0.5) * volatility;
  const summer = weekIndex >= 7 && weekIndex <= 10 ? 0.05 : 0;
  const rainDip = weekIndex === 2 || weekIndex === 6 || weekIndex === 9 ? -0.08 : 0;
  const factor = 1 + wave + wave2 + noise + summer + rainDip;
  return Math.max(8, Math.round(base * factor));
}

function sparklineValues(dailyBase: number, points: number, seed: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const weekend = i % 7 === 5 || i % 7 === 6 ? 0.78 : 1;
    const wave = Math.sin((i / points) * Math.PI * 2) * 0.12;
    const noise = (hash01(seed + i * 41) - 0.5) * 0.22;
    out.push(Math.max(1, Math.round(dailyBase * weekend * (1 + wave + noise))));
  }
  return out;
}

function changePercent(data: number[]): number {
  const mid = Math.floor(data.length / 2);
  const prev = data.slice(0, mid).reduce((a, b) => a + b, 0);
  const recent = data.slice(mid).reduce((a, b) => a + b, 0);
  if (prev === 0) return 0;
  return Math.round(((recent - prev) / prev) * 1000) / 10;
}

function dateLabels(count: number): string[] {
  const start = new Date("2026-06-03");
  const step = Math.floor(30 / (count - 1));
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i * step);
    return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, "0")}`;
  });
}

function buildMetrics(data: IcheonPublicData): DashboardMetrics {
  const parks = data.parks;
  const parkingLots = data.parkingLots;
  const protectionZones = data.protectionZones;
  const parkCount = parks.length;
  const schoolZones = protectionZones.filter((z) => z.subtype === "child").length;
  const totalParkingSpaces = parkingLots.reduce((sum, lot) => sum + lot.spaces, 0);
  const shortageZones = getParkingShortageZoneCount();

  const cctvWeeklyBase = Math.round(
    OPERATIONAL.activeCctvFeeds * 11 +
      schoolZones * 0.45 +
      parkCount * 0.35 +
      shortageZones * 0.25,
  );
  const parkingWeeklyBase = Math.round(
    shortageZones * 1.6 +
      OPERATIONAL.complaintsLast30d.parking * 0.35 +
      Math.min(18, Math.round(totalParkingSpaces / 120)),
  );
  const facilityWeeklyBase = Math.round(
    parkCount * 0.55 +
      OPERATIONAL.complaintsLast30d.facility * 0.4 +
      schoolZones * 0.12,
  );

  const heroSeries = WEEK_LABELS.map((label, i) => ({
    label,
    cctv: weeklyValue(cctvWeeklyBase, i, 0.18),
    parking: weeklyValue(parkingWeeklyBase, i, 0.2),
    facility: weeklyValue(facilityWeeklyBase, i, 0.16),
  }));

  const complaintDaily = sparklineValues(
    (OPERATIONAL.complaintsLast30d.banner +
      OPERATIONAL.complaintsLast30d.facility +
      OPERATIONAL.complaintsLast30d.parking) /
      28,
    12,
    101,
  );
  const facilityDaily = sparklineValues(facilityWeeklyBase / 7, 12, 202);
  const parkingDaily = sparklineValues(parkingWeeklyBase / 7, 12, 303);
  const snowDaily = sparklineValues(1.2, 12, 404).map((_, i, arr) => {
    const target = OPERATIONAL.snowRoutes.current;
    const progress = Math.min(target, Math.round((target / (arr.length - 1)) * i));
    return i === arr.length - 1 ? target : progress;
  });

  const labels = dateLabels(12);
  const complaintTotal = complaintDaily.reduce((a, b) => a + b, 0);
  const facilityTotal = facilityDaily.reduce((a, b) => a + b, 0);
  const parkingTotal = parkingDaily.reduce((a, b) => a + b, 0);
  const snowPct = Math.round(
    (OPERATIONAL.snowRoutes.current / OPERATIONAL.snowRoutes.total) * 100,
  );

  const trends: DashboardMetrics["trends"] = [
    {
      id: "dt1",
      title: "민원 발생 추이",
      subtitle: "최근 30일",
      value: complaintTotal,
      unit: "건",
      changePercent: changePercent(complaintDaily),
      iconName: "complaint",
      data: complaintDaily,
      labels,
      color: "#4F7FFF",
    },
    {
      id: "dt2",
      title: "시설 관리 활동",
      subtitle: "최근 30일",
      value: facilityTotal,
      unit: "건",
      changePercent: changePercent(facilityDaily),
      iconName: "facility",
      data: facilityDaily,
      labels,
      color: "#22C55E",
    },
    {
      id: "dt3",
      title: "불법 주차 단속",
      subtitle: "최근 30일",
      value: parkingTotal,
      unit: "건",
      changePercent: changePercent(parkingDaily),
      iconName: "parking",
      data: parkingDaily,
      labels,
      color: "#FF8A4C",
    },
    {
      id: "dt4",
      title: "제설 진행률",
      subtitle: `${OPERATIONAL.snowRoutes.current} / ${OPERATIONAL.snowRoutes.total} 구간`,
      value: snowPct,
      unit: "%",
      changePercent: changePercent(snowDaily),
      iconName: "snow",
      data: snowDaily,
      labels,
      color: "#A78BFA",
      isProgress: true,
      progress: OPERATIONAL.snowRoutes,
    },
  ];

  const lastHero = heroSeries[heroSeries.length - 1];
  const cctvDailyBase = lastHero.cctv / 7;
  const aiDetectionWeekly = DAY_LABELS.map((day, i) => ({
    day,
    count: Math.max(
      4,
      Math.round(cctvDailyBase * (i >= 5 ? 0.62 : 1) * (1 + (hash01(i * 53) - 0.5) * 0.15)),
    ),
  }));

  const urgent = Math.max(1, Math.round(shortageZones * 0.07));
  const high = Math.max(2, Math.round(parkingWeeklyBase / 14));
  const medium = Math.max(4, Math.round(facilityWeeklyBase / 5));
  const safe = Math.max(8, parkCount + parkingLots.length - urgent - high - medium);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      bases: {
        parkingLots: parkingLots.length,
        parks: parkCount,
        protectionZones: protectionZones.length,
        totalParkingSpaces,
        schoolZones,
        shortageZones,
        activeCctvFeeds: OPERATIONAL.activeCctvFeeds,
      },
    },
    heroSeries,
    trends,
    aiDetectionWeekly,
    aiDailySummary: [
      { label: "긴급", count: urgent, color: "#EF4444" },
      { label: "높음", count: high, color: "#F97316" },
      { label: "보통", count: medium, color: "#FBBF24" },
      { label: "안전", count: safe, color: "#22C55E" },
    ],
  };
}

function main() {
  if (!fs.existsSync(ICHEON_FILE)) {
    console.error("icheon.json not found. Run: npm run build:data");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(ICHEON_FILE, "utf-8")) as IcheonPublicData;
  const metrics = buildMetrics(data);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(metrics, null, 2), "utf-8");

  const last = metrics.heroSeries.at(-1)!;
  console.log("dashboard-metrics.json written");
  console.log(
    `  bases: 주차장 ${metrics.meta.bases.parkingLots}, 공원 ${metrics.meta.bases.parks}, 주차부족 ${metrics.meta.bases.shortageZones}곳`,
  );
  console.log(
    `  최근주 탐지: CCTV ${last.cctv}, 주차 ${last.parking}, 시설 ${last.facility} (주간)`,
  );
}

main();
