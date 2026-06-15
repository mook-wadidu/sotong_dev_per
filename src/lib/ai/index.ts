import { config } from "@/lib/config";
import { MockProvider } from "./mock";
import { GeminiProvider } from "./gemini";
import type { AiProvider } from "./types";

export * from "./types";

let cached: AiProvider | null = null;

/** 현재 설정에 맞는 AI provider (mock 기본, 키 있으면 gemini) */
export function getAi(): AiProvider {
  if (!cached) {
    cached =
      config.aiProvider === "gemini" && config.geminiApiKey
        ? new GeminiProvider()
        : new MockProvider();
  }
  return cached;
}
