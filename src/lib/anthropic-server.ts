const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function callAnthropic(
  system: string,
  userMessage: string,
  maxTokens = 1024,
): Promise<string> {
  return callAnthropicContent(system, [{ type: "text", text: userMessage }], maxTokens);
}

/** Vision: user content can mix text + base64 images */
export async function callAnthropicVision(
  system: string,
  text: string,
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg",
  maxTokens = 1200,
): Promise<string> {
  const raw = imageBase64.includes(",")
    ? imageBase64.slice(imageBase64.indexOf(",") + 1)
    : imageBase64;
  return callAnthropicContent(
    system,
    [
      {
        type: "image",
        source: { type: "base64", media_type: mediaType, data: raw },
      },
      { type: "text", text },
    ],
    maxTokens,
  );
}

async function callAnthropicContent(
  system: string,
  content: Array<Record<string, unknown>>,
  maxTokens: number,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
  }

  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API 오류 (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const text = data.content?.find((block) => block.type === "text")?.text ?? "";
  if (!text) {
    throw new Error("Anthropic API 응답에 텍스트가 없습니다.");
  }

  return text;
}

export function parseJsonFromResponse<T>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(jsonStr) as T;
}
