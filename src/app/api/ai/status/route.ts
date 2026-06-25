import { NextResponse } from "next/server";
import { isAnthropicConfigured } from "@/lib/anthropic-server";

export async function GET() {
  return NextResponse.json({
    configured: isAnthropicConfigured(),
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
  });
}
