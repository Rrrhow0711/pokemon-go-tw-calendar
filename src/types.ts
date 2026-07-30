import { z } from "zod";

// External text may contain C0 controls that are invalid in HTML and ICS.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu;
const HTML_TAG = /<[^>]*>/gu;

export function cleanText(value: string, maxLength: number): string {
  return value
    .replace(HTML_TAG, " ")
    .replace(CONTROL_CHARACTERS, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

const boundedText = (maxLength: number) =>
  z.string().transform((value) => cleanText(value, maxLength)).pipe(z.string().min(1).max(maxLength));

const safeHttpUrl = z
  .string()
  .url()
  .max(1000)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:";
  }, "URL 必須使用 HTTPS");

const leekDuckUrl = safeHttpUrl.refine(
  (value) => ["leekduck.com", "www.leekduck.com"].includes(new URL(value).hostname.toLowerCase()),
  "活動連結必須位於 leekduck.com",
);

const officialUrl = safeHttpUrl.refine(
  (value) =>
    ["pokemongo.com", "www.pokemongo.com", "pokemongolive.com", "www.pokemongolive.com"].includes(
      new URL(value).hostname.toLowerCase(),
    ),
  "官方連結網域不在 allowlist",
);

export const rawEventSchema = z
  .object({
    eventID: boundedText(200),
    name: boundedText(300),
    eventType: boundedText(100),
    heading: boundedText(200),
    link: leekDuckUrl,
    start: z.string().min(10).max(40),
    end: z.string().min(10).max(40),
    extraData: z.record(z.string(), z.unknown()).default({}),
  })
  .strip();

export type RawEvent = z.infer<typeof rawEventSchema>;

export const manualOverrideSchema = z.object({
  title: boundedText(200).optional(),
  officialUrl: officialUrl.optional(),
  description: boundedText(2000).optional(),
  disabled: z.boolean().optional(),
  notes: boundedText(1000).optional(),
});

export const manualOverridesSchema = z.record(z.string().max(200), manualOverrideSchema);
export type ManualOverride = z.infer<typeof manualOverrideSchema>;

export const pokemonNameSchema = z.object({
  english: boundedText(120),
  zhTW: boundedText(120),
  source: boundedText(300),
});

export const pokemonNamesSchema = z.array(pokemonNameSchema);
export type PokemonName = z.infer<typeof pokemonNameSchema>;

export const officialCacheEntrySchema = z.object({
  eventID: z.string().max(200),
  found: z.boolean(),
  title: z.string().max(200).optional(),
  officialUrl: officialUrl.optional(),
  fetchedAt: z.string().datetime(),
  confidence: z.number().min(0).max(1),
});

export const officialCacheSchema = z.record(z.string(), officialCacheEntrySchema);
export type OfficialCache = z.infer<typeof officialCacheSchema>;
export type OfficialCacheEntry = z.infer<typeof officialCacheEntrySchema>;

export const translationCacheEntrySchema = z.object({
  original: z.string().max(300),
  translation: z.string().min(1).max(200),
  source: z.literal("github-models"),
  model: z.string().max(100),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime(),
});

export const translationCacheSchema = z.record(z.string(), translationCacheEntrySchema);
export type TranslationCache = z.infer<typeof translationCacheSchema>;

export type TranslationSource = "manual" | "official" | "rule" | "model" | "fallback";

export interface LocalizedEvent {
  event: RawEvent;
  title: string;
  originalTitle: string;
  category: string;
  source: TranslationSource;
  officialUrl?: string;
  customDescription?: string;
}

export interface BuildStatus {
  lastSuccessfulUpdate: string;
  sourceEventCount: number;
  generatedEventCount: number;
  officialTranslationCount: number;
  ruleTranslationCount: number;
  modelTranslationCount: number;
  fallbackCount: number;
  warnings: string[];
  sourceUrl: string;
  calendarUrl: string;
}

export const buildStatusSchema = z.object({
  lastSuccessfulUpdate: z.string().datetime(),
  sourceEventCount: z.number().int().nonnegative(),
  generatedEventCount: z.number().int().nonnegative(),
  officialTranslationCount: z.number().int().nonnegative(),
  ruleTranslationCount: z.number().int().nonnegative(),
  modelTranslationCount: z.number().int().nonnegative(),
  fallbackCount: z.number().int().nonnegative(),
  warnings: z.array(z.string().max(500)),
  sourceUrl: safeHttpUrl,
  calendarUrl: z.string().url(),
});
