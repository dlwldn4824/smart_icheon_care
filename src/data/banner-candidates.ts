import {
  computeIllegalScore,
  computePriorityScore,
  reviewTierFromIllegalScore,
} from "@/lib/banner-scoring";
import type { BannerCandidate, IllegalScoreBreakdown, PriorityScoreBreakdown } from "@/types";

function buildCandidate(
  partial: Omit<
    BannerCandidate,
    "illegalScore" | "priorityScore" | "reviewTier" | "illegalBreakdown" | "priorityBreakdown"
  > & {
    illegalBreakdown: IllegalScoreBreakdown;
    priorityBreakdown: Omit<PriorityScoreBreakdown, "illegalLikelihood"> & {
      illegalLikelihood?: number;
    };
  },
): BannerCandidate {
  const illegalScore = computeIllegalScore(partial.illegalBreakdown);
  const priorityBreakdown: PriorityScoreBreakdown = {
    ...partial.priorityBreakdown,
    illegalLikelihood: partial.priorityBreakdown.illegalLikelihood ?? illegalScore,
  };
  const priorityScore = computePriorityScore(priorityBreakdown);
  return {
    ...partial,
    illegalScore,
    priorityBreakdown,
    priorityScore,
    reviewTier: reviewTierFromIllegalScore(illegalScore),
  };
}

/** CCTV 현수막 탐지 + 행정데이터 연계 후보 (불법 확정 아님) */
export const bannerCandidates: BannerCandidate[] = [
  buildCandidate({
    id: "bc1",
    trackId: "TRK-설봉-014",
    cameraId: "CAM-설봉-001",
    location: "설봉공원 입구",
    area: "설봉동",
    detectedAt: "2026.06.24 14:28:03",
    detectionConfidence: 94,
    imageUrl: "/images/illegal-banner-square.png",
    lat: 37.2795,
    lng: 127.442,
    onDesignatedBoard: false,
    permitMatched: false,
    vulnerableZones: ["공원 입구", "보행 동선"],
    complaintCount: 3,
    installDays: 12,
    illegalBreakdown: {
      unpermitted: 100,
      improperLocation: 100,
      expiredPeriod: 100,
      trafficObstruction: 60,
      repeatComplaint: 70,
    },
    priorityBreakdown: {
      safetyRisk: 75,
      footTraffic: 80,
      vulnerableZone: 70,
      complaintFrequency: 70,
      installDuration: 55,
    },
    status: "pending",
    reasons: [
      "신고대장 미일치",
      "지정 게시대 밖 설치",
      "게시 기간 정보 없음",
      "보행 동선 일부 방해",
      "동일 지점 민원 3회",
    ],
  }),
  buildCandidate({
    id: "bc2",
    trackId: "TRK-장호-008",
    cameraId: "CAM-장호-004",
    location: "장호원 사거리",
    area: "장호원읍",
    detectedAt: "2026.06.24 12:45:18",
    detectionConfidence: 92,
    imageUrl: "/images/illegal-banner-square.png",
    lat: 37.305,
    lng: 127.505,
    onDesignatedBoard: false,
    permitMatched: false,
    vulnerableZones: ["교차로", "횡단보도 주변"],
    complaintCount: 2,
    installDays: 8,
    illegalBreakdown: {
      unpermitted: 100,
      improperLocation: 95,
      expiredPeriod: 40,
      trafficObstruction: 85,
      repeatComplaint: 50,
    },
    priorityBreakdown: {
      safetyRisk: 90,
      footTraffic: 70,
      vulnerableZone: 95,
      complaintFrequency: 50,
      installDuration: 40,
    },
    status: "pending",
    reasons: [
      "신고대장 미일치",
      "전봇대 사이 가로 설치 추정",
      "교차로·횡단보도 인접",
      "시야 방해 가능성 높음",
    ],
  }),
  buildCandidate({
    id: "bc3",
    trackId: "TRK-안흥-021",
    cameraId: "CAM-안흥-011",
    location: "안흥동 상권",
    area: "안흥동",
    detectedAt: "2026.06.24 10:55:41",
    detectionConfidence: 90,
    imageUrl: "/images/illegal-banner-square.png",
    lat: 37.279,
    lng: 127.449,
    onDesignatedBoard: false,
    permitMatched: true,
    permitId: "IC-2026-0841",
    permitEndDate: "2026.06.10",
    vulnerableZones: ["상권 보행로"],
    complaintCount: 1,
    installDays: 20,
    illegalBreakdown: {
      unpermitted: 20,
      improperLocation: 70,
      expiredPeriod: 100,
      trafficObstruction: 45,
      repeatComplaint: 30,
    },
    priorityBreakdown: {
      safetyRisk: 40,
      footTraffic: 85,
      vulnerableZone: 35,
      complaintFrequency: 30,
      installDuration: 75,
    },
    status: "reviewing",
    reasons: [
      "신고대장 일치하나 게시 기간 만료",
      "지정 게시대 밖",
      "상권 보행량 높음",
    ],
  }),
  buildCandidate({
    id: "bc4",
    trackId: "TRK-중앙-003",
    cameraId: "CAM-중앙-002",
    location: "이천역 광장 게시대",
    area: "중앙동",
    detectedAt: "2026.06.24 09:12:05",
    detectionConfidence: 96,
    imageUrl: "/images/illegal-banner-after-square.png",
    lat: 37.266,
    lng: 127.443,
    onDesignatedBoard: true,
    permitMatched: true,
    permitId: "IC-2026-1102",
    permitEndDate: "2026.07.15",
    vulnerableZones: [],
    complaintCount: 0,
    installDays: 5,
    illegalBreakdown: {
      unpermitted: 5,
      improperLocation: 10,
      expiredPeriod: 0,
      trafficObstruction: 15,
      repeatComplaint: 0,
    },
    priorityBreakdown: {
      safetyRisk: 10,
      footTraffic: 60,
      vulnerableZone: 0,
      complaintFrequency: 0,
      installDuration: 20,
    },
    status: "held",
    reasons: ["지정 게시대 내", "신고대장 일치", "게시 기간 유효"],
  }),
  buildCandidate({
    id: "bc5",
    trackId: "TRK-설봉-019",
    cameraId: "CAM-설봉-012",
    location: "설봉초등학교 통학로",
    area: "설봉동",
    detectedAt: "2026.06.24 08:40:22",
    detectionConfidence: 88,
    imageUrl: "/images/illegal-banner-square.png",
    lat: 37.284,
    lng: 127.433,
    onDesignatedBoard: false,
    permitMatched: false,
    vulnerableZones: ["어린이보호구역", "통학로"],
    complaintCount: 4,
    installDays: 6,
    illegalBreakdown: {
      unpermitted: 100,
      improperLocation: 100,
      expiredPeriod: 80,
      trafficObstruction: 70,
      repeatComplaint: 85,
    },
    priorityBreakdown: {
      safetyRisk: 95,
      footTraffic: 75,
      vulnerableZone: 100,
      complaintFrequency: 85,
      installDuration: 35,
    },
    status: "pending",
    reasons: [
      "신고대장 미일치",
      "어린이보호구역·통학로",
      "반복 민원 4회",
      "보행 시야 방해 우려",
    ],
  }),
];

export const bannerCandidatesByPriority = [...bannerCandidates].sort(
  (a, b) => b.priorityScore - a.priorityScore,
);
