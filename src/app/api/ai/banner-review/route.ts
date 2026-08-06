import { NextResponse } from "next/server";
import { isLiveRequest } from "@/lib/ai-mock-server";
import {
  callAnthropicVision,
  isAnthropicConfigured,
  parseJsonFromResponse,
} from "@/lib/anthropic-server";

const SYSTEM = `당신은 지자체 도시경관 담당을 돕는 AI 보조 분석가입니다.
입력은 (1) YOLO가 그린 현수막 탐지 미리보기 이미지와 (2) 탐지 박스·Risk 요약입니다.

역할:
- 불법 여부를 확정하지 마세요. 공무원 확정 전 "의심/검토"만 제안합니다.
- YOLO가 놓쳤을 수 있는 현수막(박스 밖·겹침·작은 현수막)을 지적하세요.
- 지정게시대/허가 맥락이 없으면 "현장·대장 확인 필요"로 말하세요.
- 반드시 한국어 JSON만 출력하세요.`;

const MOCK = {
  summary:
    "탐지된 현수막 후보를 기준으로 허가·지정게시대 대조가 필요합니다. Claude 키가 없어 샘플 보조 의견을 표시합니다.",
  illegal_notes: [
    "허가 대장·지정게시대 여부는 현장에서 확인하세요.",
    "상업·정치 현수막이 밀집한 구간은 의심 우선순위가 높을 수 있습니다.",
  ],
  missed_banners: [
    "가장자리·나뭇가지에 가린 현수막은 YOLO가 놓칠 수 있습니다. conf를 낮추거나 다른 각도를 추가하세요.",
  ],
  review_priority: "중",
  disclaimer: "확정은 공무원 CONFIRMED만 가능합니다.",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const imageBase64 = typeof body.image_base64 === "string" ? body.image_base64 : "";
  const detectionSummary = body.detection_summary ?? {};
  const mediaType =
    body.media_type === "image/png" ||
    body.media_type === "image/webp" ||
    body.media_type === "image/gif"
      ? body.media_type
      : "image/jpeg";

  if (!isLiveRequest(body) || !isAnthropicConfigured() || !imageBase64) {
    return NextResponse.json({ ...MOCK, source: "mock" as const });
  }

  try {
    const userText = `YOLO 탐지 요약:
${JSON.stringify(detectionSummary, null, 2)}

위 이미지(박스 미리보기)를 보고 JSON으로 답하세요:
{
  "summary": "2문장 이내 종합",
  "illegal_notes": ["불법 의심/검토 포인트 2~4개"],
  "missed_banners": ["놓쳤을 수 있는 현수막·사각지대 1~3개"],
  "review_priority": "상|중|하",
  "disclaimer": "확정은 공무원만 가능하다는 한 문장"
}`;

    const text = await callAnthropicVision(SYSTEM, userText, imageBase64, mediaType, 1000);
    const parsed = parseJsonFromResponse<{
      summary: string;
      illegal_notes: string[];
      missed_banners: string[];
      review_priority: string;
      disclaimer: string;
    }>(text);

    return NextResponse.json({
      summary: parsed.summary ?? "",
      illegal_notes: parsed.illegal_notes ?? [],
      missed_banners: parsed.missed_banners ?? [],
      review_priority: parsed.review_priority ?? "중",
      disclaimer: parsed.disclaimer ?? "확정은 공무원 CONFIRMED만 가능합니다.",
      source: "anthropic" as const,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "배너 AI 보조 분석 실패";
    return NextResponse.json({ error: message, ...MOCK, source: "mock" as const }, { status: 200 });
  }
}
