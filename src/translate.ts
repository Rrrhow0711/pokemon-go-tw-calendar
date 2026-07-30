import { DateTime } from "luxon";
import type { PokemonNameMap } from "./pokemon-names.js";
import { translateWithGitHubModels, translationCacheKey } from "./github-models.js";
import { errorMessage } from "./io.js";
import { log } from "./log.js";
import { translateCategory, translateTitleByRule } from "./title-rules.js";
import type {
  LocalizedEvent,
  ManualOverride,
  OfficialCacheEntry,
  RawEvent,
  TranslationCache,
} from "./types.js";

export interface TranslationResult {
  events: LocalizedEvent[];
  cache: TranslationCache;
  warnings: string[];
}

interface Candidate {
  event: RawEvent;
  override?: ManualOverride;
  category: string;
  key: string;
}

export async function localizeEvents(
  events: RawEvent[],
  overrides: Readonly<Record<string, ManualOverride>>,
  officialEntries: ReadonlyMap<string, OfficialCacheEntry>,
  names: PokemonNameMap,
  cache: TranslationCache,
): Promise<TranslationResult> {
  const localized: LocalizedEvent[] = [];
  const pending: Candidate[] = [];
  const warnings: string[] = [];
  const updatedCache: TranslationCache = { ...cache };
  const now = DateTime.utc().toISO() ?? new Date().toISOString();

  for (const event of events) {
    const override = overrides[event.eventID];
    if (override?.disabled) continue;
    const category = translateCategory(event.eventType, event.heading);

    if (override?.title) {
      localized.push(makeLocalized(event, override.title, category, "manual", override));
      continue;
    }

    const official = officialEntries.get(event.eventID);
    if (official?.title) {
      const officialUrl = override?.officialUrl ?? official.officialUrl;
      localized.push({
        ...makeLocalized(event, official.title, category, "official", override),
        ...(officialUrl ? { officialUrl } : {}),
      });
      continue;
    }

    const ruleTitle = translateTitleByRule(event.name, names);
    if (ruleTitle) {
      localized.push(makeLocalized(event, ruleTitle, category, "rule", override));
      continue;
    }

    const key = translationCacheKey(event);
    const cached = cache[key];
    if (cached && cached.original === event.name) {
      updatedCache[key] = { ...cached, lastUsedAt: now };
      localized.push(makeLocalized(event, cached.translation, category, "model", override));
      continue;
    }
    pending.push({ event, category, key, ...(override ? { override } : {}) });
  }

  let modelTranslations = new Map<string, string>();
  let model = process.env.GITHUB_MODEL ?? "openai/gpt-4.1-mini";
  if (pending.length > 0) {
    try {
      const result = await translateWithGitHubModels(
        pending.map(({ event, key }) => ({ key, name: event.name, eventType: event.eventType })),
      );
      modelTranslations = result.translations;
      model = result.model;
    } catch (error: unknown) {
      const warning = `GitHub Models 無法使用，已採安全備援：${errorMessage(error)}`;
      warnings.push(warning);
      log("warn", warning);
    }
  }

  for (const candidate of pending) {
    const translation = modelTranslations.get(candidate.key);
    if (translation) {
      updatedCache[candidate.key] = {
        original: candidate.event.name,
        translation,
        source: "github-models",
        model,
        createdAt: now,
        lastUsedAt: now,
      };
      localized.push(
        makeLocalized(candidate.event, translation, candidate.category, "model", candidate.override),
      );
    } else {
      localized.push(
        makeLocalized(
          candidate.event,
          `${candidate.category}｜${candidate.event.name}`,
          candidate.category,
          "fallback",
          candidate.override,
        ),
      );
    }
  }

  const order = new Map(events.map((event, index) => [event.eventID, index]));
  localized.sort(
    (left, right) =>
      (order.get(left.event.eventID) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right.event.eventID) ?? Number.MAX_SAFE_INTEGER),
  );
  return { events: localized, cache: updatedCache, warnings };
}

function makeLocalized(
  event: RawEvent,
  title: string,
  category: string,
  source: LocalizedEvent["source"],
  override?: ManualOverride,
): LocalizedEvent {
  return {
    event,
    title,
    originalTitle: event.name,
    category,
    source,
    ...(override?.officialUrl ? { officialUrl: override.officialUrl } : {}),
    ...(override?.description ? { customDescription: override.description } : {}),
  };
}
