import { NextResponse } from "next/server";
import { buildReportContext } from "@/lib/ai-context";
import { isLiveRequest, mockReportSummary } from "@/lib/ai-mock-server";
import { callAnthropic, isAnthropicConfigured, parseJsonFromResponse } from "@/lib/anthropic-server";

const SYSTEM = `당신은 이천시 AI 리포트 작성 시스템입니다.
리포트 유형에 맞는 요약과 리스크 점수를 산출합니다. 한국어로 작성하고 JSON만 출력하세요.`;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    type?: string;
    live?: boolean;
  };

  const title = body.title ?? "일일 AI 운영 브리핑";
  const type = body.type ?? "daily";

  if (!isLiveRequest(body)) {
    return NextResponse.json({ ...mockReportSummary(title), source: "mock" });
  }

  if (!isAnthropicConfigured()) {
    return NextResponse.json({ ...mockReportSummary(title), source: "mock" });
  }

  try {
    const context = buildReportContext(title, type);
    const userMessage = `다음 데이터로 「${title}」 리포트 요약을 작성하세요.

데이터:
${JSON.stringify(context)}

JSON 형식:
{
  "summary": "3~4문장 리포트 요약",
  "highlights": ["핵심 포인트 3~5개"],
  "riskScore": 0-100 정수
}`;

    const text = await callAnthropic(SYSTEM, userMessage, 1024);
    const parsed = parseJsonFromResponse<{
      summary: string;
      highlights: string[];
      riskScore: number;
    }>(text);

    return NextResponse.json({
      summary: parsed.summary,
      highlights: parsed.highlights ?? [],
      riskScore: Math.min(100, Math.max(0, Math.round(parsed.riskScore ?? 50))),
      source: "anthropic",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "리포트 AI 요약 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
