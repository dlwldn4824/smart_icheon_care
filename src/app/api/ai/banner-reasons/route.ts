import { NextResponse } from "next/server";
import { isLiveRequest } from "@/lib/ai-mock-server";
import {
  callAnthropic,
  isAnthropicConfigured,
  parseJsonFromResponse,
} from "@/lib/anthropic-server";

const SYSTEM = `당신은 경기도 이천시 도시경관·불법광고물 담당을 돕는 AI 보조 분석가입니다.
입력은 YOLO 탐지 후보의 Risk/Priority 점수·요인 분해·공공데이터 연계 메모입니다.

역할:
- 불법 확정 금지. "처리 권장 이유"만 공무원 검토용으로 정리합니다.
- Risk(의심)·Priority(우선순위) 점수와 breakdown을 반드시 반영해 설명합니다.
- 점수가 높은 요인을 우선으로, 공공데이터(허가·지정게시대·민원·취약구역) 근거를 쉬운 한국어로 씁니다.
- 현장 확인·허가 대장 대조가 필요한 항목을 분명히 적습니다.
- 반드시 한국어 JSON만 출력하세요.`;

function buildMock(reasons: string[]) {
  const base =
    reasons.length > 0
      ? reasons.slice(0, 4)
      : [
          "지정게시대·허가 대장과 미일치 가능성이 있어 현장 확인이 필요합니다.",
          "보행 동선·취약구역 인근이면 우선 점검 대상입니다.",
        ];
  return {
    summary: "공공데이터 연계 결과를 바탕으로 처리 권장 이유를 정리했습니다. (샘플)",
    reasons: base.map((r) => (r.startsWith("Claude") ? r : r)),
    next_actions: ["허가 대장 대조", "현장 위치·게시대 확인", "필요 시 철거·시정 안내"],
    disclaimer: "확정은 공무원 CONFIRMED만 가능합니다.",
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const candidate = (body.candidate ?? {}) as Record<string, unknown>;
  const rawReasons = Array.isArray(body.reasons)
    ? body.reasons.map(String).filter(Boolean)
    : [];

  const mock = buildMock(rawReasons);

  if (!isLiveRequest(body) || !isAnthropicConfigured()) {
    return NextResponse.json({ ...mock, source: "mock" as const });
  }

  try {
    const userMessage = `현수막 후보 요약 (점수·요인 포함):
${JSON.stringify(candidate, null, 2)}

공공데이터·Risk 원본 메모:
${JSON.stringify(rawReasons, null, 2)}

Risk/Priority 점수를 근거로 공무원용 "처리 권장 이유"를 작성하세요. JSON:
{
  "summary": "1~2문장 종합 (점수 언급 가능)",
  "reasons": ["처리 권장 이유 3~5개 (점수·공공데이터 근거 포함)"],
  "next_actions": ["즉시 할 일 2~3개"],
  "disclaimer": "확정은 공무원만 가능하다는 한 문장"
}`;

    const text = await callAnthropic(SYSTEM, userMessage, 900);
    const parsed = parseJsonFromResponse<{
      summary: string;
      reasons: string[];
      next_actions: string[];
      disclaimer: string;
    }>(text);

    return NextResponse.json({
      summary: parsed.summary ?? mock.summary,
      reasons: parsed.reasons?.length ? parsed.reasons : mock.reasons,
      next_actions: parsed.next_actions?.length ? parsed.next_actions : mock.next_actions,
      disclaimer: parsed.disclaimer ?? mock.disclaimer,
      source: "anthropic" as const,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "처리 권장 이유 생성 실패";
    return NextResponse.json({ error: message, ...mock, source: "mock" as const }, { status: 200 });
  }
}
