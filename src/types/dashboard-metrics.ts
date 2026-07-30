export interface DashboardMetricsMeta {
  generatedAt: string;
  bases: {
    parkingLots: number;
    parks: number;
    protectionZones: number;
    totalParkingSpaces: number;
    schoolZones: number;
    shortageZones: number;
    activeCctvFeeds: number;
  };
}

export interface DashboardHeroPoint {
  label: string;
  cctv: number;
  parking: number;
  facility: number;
}

export interface DashboardTrendPoint {
  id: string;
  title: string;
  subtitle: string;
  value: number;
  unit: string;
  changePercent: number;
  iconName: "complaint" | "facility" | "parking" | "snow";
  data: number[];
  labels: string[];
  color: string;
  isProgress?: boolean;
  progress?: { current: number; total: number };
}

export interface DashboardMetrics {
  meta: DashboardMetricsMeta;
  heroSeries: DashboardHeroPoint[];
  trends: DashboardTrendPoint[];
  aiDetectionWeekly: { day: string; count: number }[];
  aiDailySummary: { label: string; count: number; color: string }[];
}
