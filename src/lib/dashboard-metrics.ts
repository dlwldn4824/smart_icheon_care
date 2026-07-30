import type { DashboardMetrics } from "@/types/dashboard-metrics";
import generated from "@/data/generated/dashboard-metrics.json";

const metrics = generated as DashboardMetrics;

export const dashboardMetricsMeta = metrics.meta;
export const dashboardHeroSeries = metrics.heroSeries;
export const dashboardTrends = metrics.trends;
export const aiDetectionWeekly = metrics.aiDetectionWeekly;
export const aiDailySummary = metrics.aiDailySummary;

export type { DashboardMetrics, DashboardHeroPoint, DashboardTrendPoint } from "@/types/dashboard-metrics";
