import type {
  BannerReviewTier,
  IllegalScoreBreakdown,
  PriorityScoreBreakdown,
} from "@/types";

/** 불법 가능성 점수 가중치 (합 = 1.0) */
export const ILLEGAL_WEIGHTS = {
  unpermitted: 0.3,
  improperLocation: 0.25,
  expiredPeriod: 0.2,
  trafficObstruction: 0.15,
  repeatComplaint: 0.1,
} as const;

/** 행정 대응 우선순위 가중치 (합 = 1.0) */
export const PRIORITY_WEIGHTS = {
  illegalLikelihood: 0.35,
  safetyRisk: 0.25,
  footTraffic: 0.15,
  vulnerableZone: 0.1,
  complaintFrequency: 0.1,
  installDuration: 0.05,
} as const;

export function computeIllegalScore(breakdown: IllegalScoreBreakdown): number {
  const score =
    ILLEGAL_WEIGHTS.unpermitted * breakdown.unpermitted +
    ILLEGAL_WEIGHTS.improperLocation * breakdown.improperLocation +
    ILLEGAL_WEIGHTS.expiredPeriod * breakdown.expiredPeriod +
    ILLEGAL_WEIGHTS.trafficObstruction * breakdown.trafficObstruction +
    ILLEGAL_WEIGHTS.repeatComplaint * breakdown.repeatComplaint;
  return Math.round(score);
}

export function computePriorityScore(breakdown: PriorityScoreBreakdown): number {
  const score =
    PRIORITY_WEIGHTS.illegalLikelihood * breakdown.illegalLikelihood +
    PRIORITY_WEIGHTS.safetyRisk * breakdown.safetyRisk +
    PRIORITY_WEIGHTS.footTraffic * breakdown.footTraffic +
    PRIORITY_WEIGHTS.vulnerableZone * breakdown.vulnerableZone +
    PRIORITY_WEIGHTS.complaintFrequency * breakdown.complaintFrequency +
    PRIORITY_WEIGHTS.installDuration * breakdown.installDuration;
  return Math.round(score);
}

export function reviewTierFromIllegalScore(score: number): BannerReviewTier {
  if (score >= 80) return "urgent";
  if (score >= 60) return "priority";
  if (score >= 40) return "normal";
  return "observe";
}

export const reviewTierLabel: Record<BannerReviewTier, string> = {
  urgent: "긴급 확인",
  priority: "우선 확인",
  normal: "일반 확인",
  observe: "관찰",
};

export const illegalFactorLabel: Record<keyof IllegalScoreBreakdown, string> = {
  unpermitted: "미허가 가능성",
  improperLocation: "부적절 위치",
  expiredPeriod: "게시 기간 만료",
  trafficObstruction: "보행·교통 방해",
  repeatComplaint: "반복 민원",
};

export const priorityFactorLabel: Record<keyof PriorityScoreBreakdown, string> = {
  illegalLikelihood: "불법 가능성",
  safetyRisk: "안전 위험도",
  footTraffic: "보행량",
  vulnerableZone: "취약지역",
  complaintFrequency: "민원 빈도",
  installDuration: "설치 지속",
};
