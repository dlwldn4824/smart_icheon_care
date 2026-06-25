import type { Recommendation } from "@/types";

export const MOCK_BRIEFING = {
  summary:
    "이천시 전역 AI 탐지 47건, 주차 부족 28구역, 긴급 민원 2건이 확인되었습니다. 설봉·안흥 일대 시설·주차 이슈가 집중되어 우선 점검이 필요합니다.",
  highlights: [
    "설봉초 인근 주차 갈등 핫스팟",
    "안흥공원 잔디 과성장 3구역",
    "신둔면 학교구역 제설 우선",
    "불법 현수막 5건 탐지",
  ],
};

export const MOCK_RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rec1",
    priority: "urgent",
    title: "설봉초등학교 인근 임시 주차장 설치 권고",
    detail: "주차 수요·학교구역 겹침으로 갈등 위험이 높습니다.",
    score: 87,
  },
  {
    id: "rec2",
    priority: "high",
    title: "안흥공원 잔디 정비 및 방제 작업 권고",
    detail: "CCTV AI가 잔디 과성장 3구역을 감지했습니다.",
  },
  {
    id: "rec3",
    priority: "medium",
    title: "신둔면 학교구역 제설 우선 처리 권고",
    detail: "기상 예보 기반 제설 우선순위 1위 구역입니다.",
  },
];

export const MOCK_PARKING = {
  analysis:
    "설봉동·장호원읍 일대 통학·퇴근 시간대 주차 수요가 공영주차 공급을 초과합니다. 학교 보호구역 인근 불법 주차가 갈등 점수를 높이고 있습니다.",
  actions: [
    "설봉초등학교 인근 임시 주차장 검토",
    "통학 시간대 주차 단속 강화",
    "공영주차장 안내 표지 확대",
  ],
};

export function mockReportSummary(title: string) {
  return {
    summary: `「${title}」 기준 이천시 주차·CCTV·시설·제설·민원 데이터를 종합한 샘플 요약입니다. 긴급 구역 우선 조치와 주말 모니터링 강화가 권고됩니다.`,
    highlights: [
      "주차 부족 28구역 중 상위 5곳 집중 관리",
      "CCTV AI 탐지 4건 현장 배정 필요",
      "제설 진행률 64% — 잔여 18구간",
    ],
    riskScore: 68,
  };
}

export function isLiveRequest(body: unknown): boolean {
  return typeof body === "object" && body !== null && (body as { live?: boolean }).live === true;
}
