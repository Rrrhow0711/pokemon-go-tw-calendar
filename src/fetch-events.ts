import { z } from "zod";
import { SOURCE_ALLOWLIST, SOURCE_URL } from "./config.js";
import { errorMessage } from "./io.js";
import { log } from "./log.js";
import { fetchWithPolicy } from "./network.js";
import { rawEventSchema, type RawEvent } from "./types.js";

const sourceArraySchema = z.array(z.unknown()).max(5000);

export interface FetchEventsResult {
  events: RawEvent[];
  warnings: string[];
  receivedCount: number;
}

export async function fetchEvents(sourceUrl = SOURCE_URL): Promise<FetchEventsResult> {
  const response = await fetchWithPolicy(sourceUrl, {
    allowedHosts: SOURCE_ALLOWLIST,
    timeoutMs: 15_000,
    retries: 3,
  });
  if (!response.ok) {
    throw new Error(`ScrapedDuck 回傳 HTTP ${response.status}`);
  }

  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > 10 * 1024 * 1024) {
    throw new Error("ScrapedDuck 回應超過 10 MiB 安全上限");
  }

  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch (error: unknown) {
    throw new Error(`ScrapedDuck JSON 無法解析：${errorMessage(error)}`, { cause: error });
  }

  return parseEvents(json);
}

export function parseEvents(input: unknown): FetchEventsResult {
  const rawItems = sourceArraySchema.parse(input);
  const events: RawEvent[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();

  for (const [index, item] of rawItems.entries()) {
    const parsed = rawEventSchema.safeParse(item);
    if (!parsed.success) {
      const warning = `第 ${index + 1} 筆活動格式異常，已跳過：${parsed.error.issues[0]?.message ?? "未知錯誤"}`;
      warnings.push(warning);
      log("warn", warning);
      continue;
    }
    if (seenIds.has(parsed.data.eventID)) {
      const warning = `eventID ${parsed.data.eventID} 重複，已保留第一筆`;
      warnings.push(warning);
      log("warn", warning);
      continue;
    }
    seenIds.add(parsed.data.eventID);
    events.push(parsed.data);
  }

  return { events, warnings, receivedCount: rawItems.length };
}

export function assertSourceHealthy(
  currentCount: number,
  previousCount: number | undefined,
  minimumRatio = Number(process.env.MIN_SOURCE_RATIO ?? "0.5"),
): void {
  if (currentCount === 0) {
    throw new Error("來源回傳 0 筆有效活動；拒絕覆蓋上一版行事曆");
  }
  if (
    previousCount !== undefined &&
    previousCount >= 10 &&
    currentCount < Math.ceil(previousCount * minimumRatio)
  ) {
    throw new Error(
      `來源筆數由 ${previousCount} 異常下降至 ${currentCount}（門檻 ${Math.round(minimumRatio * 100)}%）；拒絕覆蓋`,
    );
  }
}
