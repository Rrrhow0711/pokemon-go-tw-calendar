import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DATA_DIR,
  FIXTURE_DIR,
  PUBLIC_DIR,
  SOURCE_URL,
  resolveSiteBaseUrl,
} from "./config.js";
import { buildPage } from "./build-page.js";
import { assertSourceHealthy, fetchEvents, parseEvents } from "./fetch-events.js";
import { buildCalendar } from "./ics.js";
import { readJson, writeJsonAtomic, writeTextAtomic } from "./io.js";
import { log } from "./log.js";
import { resolveOfficialTranslations } from "./official-zh.js";
import { loadPokemonNames } from "./pokemon-names.js";
import { localizeEvents } from "./translate.js";
import {
  buildStatusSchema,
  manualOverridesSchema,
  officialCacheSchema,
  translationCacheSchema,
  type BuildStatus,
} from "./types.js";
import { validateIcs } from "./validate-ics.js";

export interface BuildOptions {
  fixture?: boolean;
  now?: Date;
}

export async function runBuild(options: BuildOptions = {}): Promise<BuildStatus> {
  const fixture = options.fixture ?? false;
  const now = options.now ?? new Date();
  const siteBaseUrl = resolveSiteBaseUrl();
  const calendarUrl = new URL("pokemon-go-zh-TW.ics", siteBaseUrl).href;

  const [source, overrides, names, translationCache, officialCache, previousStatus] =
    await Promise.all([
      loadSource(fixture),
      readJson(path.join(DATA_DIR, "manual-overrides.zh-TW.json"), manualOverridesSchema),
      loadPokemonNames(),
      readJson(path.join(DATA_DIR, "translation-cache.json"), translationCacheSchema, {}),
      readJson(path.join(DATA_DIR, "official-page-cache.json"), officialCacheSchema, {}),
      readJson(
        path.join(PUBLIC_DIR, "status.json"),
        buildStatusSchema.nullable(),
        null,
      ),
    ]);

  assertSourceHealthy(
    source.events.length,
    fixture ? undefined : previousStatus?.sourceEventCount,
  );
  log("info", "活動來源擷取完成", {
    received: source.receivedCount,
    valid: source.events.length,
    fixture,
  });

  const official = await resolveOfficialTranslations(source.events, officialCache, {
    skipNetwork: fixture,
  });
  const translation = await localizeEvents(
    source.events,
    overrides,
    official.entries,
    names,
    translationCache,
  );
  const calendar = buildCalendar(translation.events);
  if (calendar.eventCount === 0) {
    throw new Error("產生 0 筆 VEVENT；拒絕覆蓋上一版行事曆");
  }
  validateIcs(calendar.content);

  const warnings = [
    ...source.warnings,
    ...official.warnings,
    ...translation.warnings,
    ...calendar.warnings,
  ].slice(0, 100);
  const status: BuildStatus = {
    lastSuccessfulUpdate: now.toISOString(),
    sourceEventCount: source.events.length,
    generatedEventCount: calendar.eventCount,
    officialTranslationCount: translation.events.filter(({ source: itemSource }) => itemSource === "official").length,
    ruleTranslationCount: translation.events.filter(({ source: itemSource }) => itemSource === "rule").length,
    modelTranslationCount: translation.events.filter(({ source: itemSource }) => itemSource === "model").length,
    fallbackCount: translation.events.filter(({ source: itemSource }) => itemSource === "fallback").length,
    warnings,
    sourceUrl: SOURCE_URL,
    calendarUrl,
  };
  buildStatusSchema.parse(status);
  const page = buildPage(status, siteBaseUrl);

  await Promise.all([
    writeTextAtomic(path.join(PUBLIC_DIR, "pokemon-go-zh-TW.ics"), calendar.content),
    writeJsonAtomic(path.join(PUBLIC_DIR, "status.json"), status),
    writeTextAtomic(path.join(PUBLIC_DIR, "index.html"), page),
    writeJsonAtomic(path.join(DATA_DIR, "translation-cache.json"), translation.cache),
    writeJsonAtomic(path.join(DATA_DIR, "official-page-cache.json"), official.cache),
  ]);

  log("info", "行事曆建置完成", {
    sourceEvents: status.sourceEventCount,
    officialTranslations: status.officialTranslationCount,
    ruleTranslations: status.ruleTranslationCount,
    modelTranslations: status.modelTranslationCount,
    fallbacks: status.fallbackCount,
    vevents: status.generatedEventCount,
    warnings: status.warnings.length,
  });
  return status;
}

async function loadSource(fixture: boolean) {
  if (!fixture) return fetchEvents();
  const text = await readFile(path.join(FIXTURE_DIR, "events.json"), "utf8");
  return parseEvents(JSON.parse(text) as unknown);
}

async function main(): Promise<void> {
  await runBuild({ fixture: process.argv.includes("--fixture") });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
