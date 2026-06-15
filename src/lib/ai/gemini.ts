import "server-only";
import { config } from "@/lib/config";
import type {
  DesignerSummary,
  HairReportDraft,
  ThreeLevel,
} from "@/lib/domain/types";
import { NATIONALITY_BY_LOCALE } from "@/lib/domain/types";
import { MockProvider } from "./mock";
import {
  REPORT_SCHEMA,
  SUMMARY_SCHEMA,
  buildReportPrompt,
  buildSummarizePrompt,
  buildTranslatePrompt,
  type GeminiSchema,
} from "./prompts";
import type {
  AiProvider,
  ReportInput,
  SummarizeInput,
  TranslateInput,
} from "./types";

/**
 * GeminiProvider — Google Gemini(생성형) 실 구현. SDK 없이 REST fetch.
 *
 * 동작 환경:
 * - GEMINI_API_KEY 가 설정되어 있으면 lib/ai/index.ts 가 이 provider 를 선택한다.
 *   (env: GEMINI_API_KEY 필수, GEMINI_MODEL 선택 — 기본 gemini-2.5-flash)
 * - 키가 없으면 기본 경로는 MockProvider 이므로, 이 파일은 라이브 호출 없이도
 *   TS 컴파일/타입 계약만 보장되면 된다.
 *
 * 견고성 원칙:
 * - 모든 메서드는 try/catch 로 감싸 실패 시 MockProvider 결과로 폴백한다
 *   (console.warn 로 흔적 남김). 데모 루프가 절대 깨지지 않도록.
 * - summarize/report 는 responseMimeType="application/json" + responseSchema 로
 *   구조화 출력을 강제하고, 코드펜스 제거 후 파싱 → 누락 필드는 mock 으로 보강.
 * - translate 는 text/plain, trim + 코드펜스/따옴표 제거.
 *
 * 차별점(PRD §2.4): 미용 도메인 힌트를 프롬프트에 주입해 용어/톤을 맞춘다.
 */
export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  private fallback = new MockProvider();

  async summarizeIntake(input: SummarizeInput): Promise<DesignerSummary> {
    try {
      const text = await this.generate({
        prompt: buildSummarizePrompt(input),
        json: true,
        schema: SUMMARY_SCHEMA,
        // 요약은 정리·번역 작업뿐 — 추론(thinking) 불필요. 토큰/지연 낭비 차단.
        thinkingBudget: 0,
      });
      const parsed = parseJsonObject(text);
      if (!parsed) throw new Error("summarize: empty/invalid JSON");
      return this.mapSummary(parsed, input);
    } catch (err) {
      console.warn("[gemini] summarizeIntake fallback → mock:", asMsg(err));
      return this.fallback.summarizeIntake(input);
    }
  }

  async translate(input: TranslateInput): Promise<string> {
    if (input.from === input.to) return input.text;
    try {
      const text = await this.generate({
        prompt: buildTranslatePrompt(input),
        json: false,
        // 번역은 직역 작업 — 추론(thinking) 불필요. 토큰/지연 낭비 차단.
        thinkingBudget: 0,
      });
      const cleaned = cleanText(text);
      if (!cleaned) throw new Error("translate: empty output");
      return cleaned;
    } catch (err) {
      console.warn("[gemini] translate fallback → mock:", asMsg(err));
      return this.fallback.translate(input);
    }
  }

  async draftReport(input: ReportInput): Promise<HairReportDraft> {
    try {
      const text = await this.generate({
        prompt: buildReportPrompt(input),
        json: true,
        schema: REPORT_SCHEMA,
        // 리포트는 케어 문구 생성 — 약간의 구성만 필요. 최소 thinking.
        thinkingBudget: 0,
      });
      const parsed = parseJsonObject(text);
      if (!parsed) throw new Error("report: empty/invalid JSON");
      const mockDraft = await this.fallback.draftReport(input);
      return this.mapReport(parsed, mockDraft);
    } catch (err) {
      console.warn("[gemini] draftReport fallback → mock:", asMsg(err));
      return this.fallback.draftReport(input);
    }
  }

  /* ── REST 호출 ─────────────────────────────────────────── */

  private async generate(opts: {
    prompt: string;
    json: boolean;
    schema?: GeminiSchema;
    /** gemini-2.5-flash thinking 예산(토큰). 0=비활성(번역/요약 낭비 절감). */
    thinkingBudget?: number;
  }): Promise<string> {
    if (!config.geminiApiKey) throw new Error("GEMINI_API_KEY missing");

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(config.geminiModel)}:generateContent` +
      `?key=${encodeURIComponent(config.geminiApiKey)}`;

    const generationConfig: Record<string, unknown> = {
      temperature: opts.json ? 0.2 : 0.3,
    };
    if (opts.json) {
      generationConfig.responseMimeType = "application/json";
      if (opts.schema) generationConfig.responseSchema = opts.schema;
    } else {
      generationConfig.responseMimeType = "text/plain";
    }
    // thinking 비활성/축소 — translate/summarize/report 는 추론 불필요(2.5-flash).
    if (typeof opts.thinkingBudget === "number") {
      generationConfig.thinkingConfig = {
        thinkingBudget: opts.thinkingBudget,
      };
    }

    const body = {
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // 외부 LLM 응답은 캐싱하지 않는다.
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await safeText(res);
      throw new Error(`Gemini HTTP ${res.status}: ${detail.slice(0, 300)}`);
    }

    const data = (await res.json()) as GeminiResponse;
    const out = extractText(data);
    if (!out) throw new Error("Gemini: no text in response");
    return out;
  }

  /* ── 응답 → 도메인 타입 매핑 (누락 필드 보강) ─────────────── */

  private mapSummary(
    raw: Record<string, unknown>,
    input: SummarizeInput,
  ): DesignerSummary {
    const services = strArr(raw.services, input.serviceLabelsKo);
    const nationality =
      str(raw.nationality) || NATIONALITY_BY_LOCALE[input.customerLocale];
    const headline =
      str(raw.headline) ||
      [
        nationality,
        input.isReturning ? "재방문" : "신규",
        services.join("+"),
      ]
        .filter(Boolean)
        .join(" · ");
    const estimatedPrice = str(raw.estimatedPrice) || input.estimatedPriceKo;

    return {
      headline,
      nationality,
      isReturning:
        typeof raw.isReturning === "boolean"
          ? raw.isReturning
          : input.isReturning,
      services,
      styleDetail: str(raw.styleDetail) || "디테일 미입력",
      hairCautions: str(raw.hairCautions) || "특이사항 없음",
      concerns:
        str(raw.concerns) ||
        (input.concernLabelsKo.length
          ? input.concernLabelsKo.join(", ")
          : "없음"),
      estimatedPrice: estimatedPrice || undefined,
      raw: str(raw.raw) || headline,
    };
  }

  private mapReport(
    raw: Record<string, unknown>,
    mock: HairReportDraft,
  ): HairReportDraft {
    const grade = asThreeLevel(raw.hairStateGrade) ?? mock.hairStateGrade;
    const score = clampScore(raw.hairStateScore, mock.hairStateScore);

    return {
      serviceSummary: str(raw.serviceSummary) || mock.serviceSummary,
      products: strArr(raw.products, mock.products),
      hairStateGrade: grade,
      hairStateScore: score,
      homeCare: strArr(raw.homeCare, mock.homeCare),
      nextVisitWeeks: posInt(raw.nextVisitWeeks, mock.nextVisitWeeks),
    };
  }
}

/* ── Gemini 응답 타입 (필요 부분만) ─────────────────────────── */
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

function extractText(data: GeminiResponse): string {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts || !parts.length) return "";
  return parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

/* ── 파싱/정규화 유틸 ──────────────────────────────────────── */

/** 코드펜스/선행 라벨 제거 후 첫 JSON 오브젝트를 파싱. */
function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = stripFences(text);
  // 1) 통째로 시도
  const direct = tryParse(cleaned);
  if (direct) return direct;
  // 2) 첫 '{' ~ 마지막 '}' 슬라이스 시도 (앞뒤 잡설 제거)
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const sliced = tryParse(cleaned.slice(start, end + 1));
    if (sliced) return sliced;
  }
  return null;
}

function tryParse(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** ```json ... ``` 또는 ``` ... ``` 코드펜스를 벗긴다. */
function stripFences(text: string): string {
  let t = text.trim();
  const fence = /^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/;
  const m = fence.exec(t);
  if (m) t = m[1].trim();
  return t;
}

/** 평문 번역 응답 정리: 코드펜스/감싼 따옴표 제거. */
function cleanText(text: string): string {
  let t = stripFences(text).trim();
  // 전체를 감싼 따옴표 한 겹 제거 ("...", '...', “...”)
  const wrapped = /^["'“]([\s\S]*)["'”]$/.exec(t);
  if (wrapped) t = wrapped[1].trim();
  return t;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strArr(v: unknown, fallback: string[]): string[] {
  if (Array.isArray(v)) {
    const arr = v
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x) => x.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
}

function asThreeLevel(v: unknown): ThreeLevel | null {
  return v === "high" || v === "mid" || v === "low" ? v : null;
}

function posInt(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

function clampScore(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function asMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
