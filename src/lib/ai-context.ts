import {
  complaints,
  detectionEvents,
  facilities,
  hotspots,
  recommendations,
  riskCards,
  snowRemovalRoutes,
} from "@/data/mock";

/** Anthropic API 프롬프트용 — 토큰 절약을 위해 요약 스냅샷만 전달 */
export function buildOperationalContext() {
  return {
    city: "이천시",
    date: "2026-06-24",
    risks: riskCards.map((r) => ({
      title: r.title,
      level: r.riskLevel,
      count: r.count,
      changePercent: r.changePercent,
    })),
    hotspots: hotspots.slice(0, 4).map((h) => ({
      name: h.name,
      score: h.score,
      priority: h.priority,
    })),
    recentDetections: detectionEvents.slice(0, 5).map((d) => ({
      type: d.type,
      location: d.location,
      severity: d.severity,
    })),
    openComplaints: complaints
      .filter((c) => c.status !== "completed")
      .slice(0, 6)
      .map((c) => ({
        category: c.category,
        title: c.title,
        priority: c.priority,
        status: c.status,
      })),
    urgentFacilities: facilities
      .filter((f) => f.priority === "urgent" || f.priority === "high")
      .slice(0, 4)
      .map((f) => ({ name: f.name, priority: f.priority, aiStatus: f.aiStatus })),
    snowRoutes: snowRemovalRoutes
      .filter((r) => r.status !== "completed")
      .slice(0, 4)
      .map((r) => ({ name: r.name, priority: r.priority, progress: r.progress })),
    recommendationTitles: recommendations.map((r) => r.title),
  };
}

export function buildBriefingContext() {
  const operational = buildOperationalContext();
  return {
    ...operational,
    complaintStats: {
      total: complaints.length,
      open: complaints.filter((c) => c.status !== "completed").length,
      urgent: complaints.filter((c) => c.priority === "urgent").length,
    },
    snowProgress: {
      total: snowRemovalRoutes.length,
      completed: snowRemovalRoutes.filter((r) => r.status === "completed").length,
    },
  };
}

export function buildParkingContext() {
  return {
    city: "이천시",
    hotspots: hotspots.slice(0, 5).map((h) => ({
      name: h.name,
      score: h.score,
      recommendation: h.recommendation,
    })),
    note: "통학·퇴근 시간대 주차 수요 집중",
  };
}

export function buildReportContext(reportTitle: string, reportType: string) {
  return {
    reportTitle,
    reportType,
    briefing: buildBriefingContext(),
  };
}
