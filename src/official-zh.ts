import * as cheerio from "cheerio";
import { DateTime } from "luxon";
import { OFFICIAL_ALLOWLIST } from "./config.js";
import { errorMessage } from "./io.js";
import { log } from "./log.js";
import { fetchWithPolicy } from "./network.js";
import { cleanText, type OfficialCache, type OfficialCacheEntry, type RawEvent } from "./types.js";

const EXCLUDED_HEADINGS = [
  "主角寶可夢",
  "活動獎勵加碼內容",
  "活動入場券",
  "活動詳情",
  "可遇見的寶可夢",
  "團體戰",
  "田野調查",
];

const FOUND_TTL_DAYS = 7;
const MISSING_TTL_HOURS = 24;

export interface OfficialLookupResult {
  entries: Map<string, OfficialCacheEntry>;
  cache: OfficialCache;
  warnings: string[];
}

export interface OfficialLookupOptions {
  now?: DateTime;
  skipNetwork?: boolean;
  fetchPage?: (url: string) => Promise<{ status: number; html: string; finalUrl: string }>;
}

export async function resolveOfficialTranslations(
  events: RawEvent[],
  cache: OfficialCache,
  options: OfficialLookupOptions = {},
): Promise<OfficialLookupResult> {
  const now = options.now ?? DateTime.utc();
  const updatedCache: OfficialCache = { ...cache };
  const entries = new Map<string, OfficialCacheEntry>();
  const warnings: string[] = [];
  const pending: RawEvent[] = [];

  for (const event of events) {
    const cached = cache[event.eventID];
    if (cached && isFresh(cached, now)) {
      if (cached.found && cached.title) entries.set(event.eventID, cached);
    } else if (!options.skipNetwork) {
      pending.push(event);
    }
  }

  const fetchPage = options.fetchPage ?? defaultFetchPage;
  const queue = [...pending];
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length > 0) {
      const event = queue.shift();
      if (!event) return;
      try {
        const entry = await fetchOfficialEntry(event, now, fetchPage);
        updatedCache[event.eventID] = entry;
        if (entry.found && entry.title) entries.set(event.eventID, entry);
      } catch (error: unknown) {
        const warning = `官方繁中頁面 ${event.eventID} 擷取失敗：${errorMessage(error)}`;
        warnings.push(warning);
        log("warn", warning);
      }
    }
  });
  await Promise.all(workers);

  return { entries, cache: updatedCache, warnings };
}

export function extractOfficialTitle(
  html: string,
  event: Pick<RawEvent, "eventID" | "name" | "start">,
  finalUrl?: string,
): { title: string; confidence: number } | undefined {
  if (Buffer.byteLength(html, "utf8") > 2 * 1024 * 1024) return undefined;
  const $ = cheerio.load(html);
  $("script, style, template, noscript").remove();
  const bodyText = cleanText($("body").text(), 100_000);
  const expectedYear = /(?:19|20)\d{2}/u.exec(event.start)?.[0] ??
    /(?:19|20)\d{2}/u.exec(event.eventID)?.[0];
  const yearMatches = expectedYear ? bodyText.includes(expectedYear) : true;
  const finalPathMatches = finalUrl
    ? decodeURIComponent(new URL(finalUrl).pathname).includes(event.eventID)
    : true;

  const candidates = $("h2")
    .toArray()
    .map((element) => cleanText($(element).text(), 200))
    .filter((title) => isMeaningfulHeading(title));

  for (const title of candidates) {
    let confidence = 0.55;
    if (/[\u3400-\u9FFF]/u.test(title)) confidence += 0.15;
    if (yearMatches) confidence += 0.15;
    if (finalPathMatches) confidence += 0.1;
    if (title.length >= 4 && title.length <= 80) confidence += 0.05;
    if (confidence >= 0.75) {
      return { title, confidence: Math.min(confidence, 1) };
    }
  }
  return undefined;
}

function isMeaningfulHeading(title: string): boolean {
  if (title.length < 3 || title.length > 100) return false;
  return !EXCLUDED_HEADINGS.some(
    (excluded) => title === excluded || title.startsWith(`${excluded}：`),
  );
}

function isFresh(entry: OfficialCacheEntry, now: DateTime): boolean {
  const fetchedAt = DateTime.fromISO(entry.fetchedAt, { setZone: true });
  if (!fetchedAt.isValid) return false;
  const ttl = entry.found
    ? { days: FOUND_TTL_DAYS }
    : { hours: MISSING_TTL_HOURS };
  return fetchedAt.plus(ttl) > now;
}

async function fetchOfficialEntry(
  event: RawEvent,
  now: DateTime,
  fetchPage: (url: string) => Promise<{ status: number; html: string; finalUrl: string }>,
): Promise<OfficialCacheEntry> {
  const url = `https://pokemongo.com/zh-Hant/news/${encodeURIComponent(event.eventID)}`;
  const response = await fetchPage(url);
  if (response.status === 404) {
    return {
      eventID: event.eventID,
      found: false,
      fetchedAt: now.toISO() ?? now.toUTC().toString(),
      confidence: 1,
    };
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}`);
  }

  const extracted = extractOfficialTitle(response.html, event, response.finalUrl);
  if (!extracted) {
    return {
      eventID: event.eventID,
      found: false,
      fetchedAt: now.toISO() ?? now.toUTC().toString(),
      confidence: 0,
    };
  }
  return {
    eventID: event.eventID,
    found: true,
    title: extracted.title,
    officialUrl: response.finalUrl,
    fetchedAt: now.toISO() ?? now.toUTC().toString(),
    confidence: extracted.confidence,
  };
}

async function defaultFetchPage(
  url: string,
): Promise<{ status: number; html: string; finalUrl: string }> {
  const response = await fetchWithPolicy(url, {
    allowedHosts: OFFICIAL_ALLOWLIST,
    timeoutMs: 10_000,
    retries: 2,
  });
  return {
    status: response.status,
    html: await response.text(),
    finalUrl: response.url || url,
  };
}
