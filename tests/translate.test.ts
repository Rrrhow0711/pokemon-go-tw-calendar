import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { translationCacheKey } from "../src/github-models.js";
import { loadPokemonNames, type PokemonNameMap } from "../src/pokemon-names.js";
import { localizeEvents } from "../src/translate.js";
import type { RawEvent, TranslationCache } from "../src/types.js";

let names: PokemonNameMap;
beforeAll(async () => {
  names = await loadPokemonNames();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const unknown: RawEvent = {
  eventID: "unknown-event",
  name: "Starlight Research Celebration",
  eventType: "event",
  heading: "Event",
  link: "https://leekduck.com/events/unknown-event/",
  start: "2026-08-20T10:00:00.000",
  end: "2026-08-20T12:00:00.000",
  extraData: {},
};

describe("分層中文化", () => {
  it("人工覆寫優先於官方與規則", async () => {
    const event = { ...unknown, name: "Bidoof Spotlight Hour" };
    const result = await localizeEvents(
      [event],
      { [event.eventID]: { title: "人工名稱" } },
      new Map([
        [
          event.eventID,
          {
            eventID: event.eventID,
            found: true,
            title: "官方名稱",
            fetchedAt: "2026-07-30T00:00:00.000Z",
            confidence: 0.9,
          },
        ],
      ]),
      names,
      {},
    );
    expect(result.events[0]?.title).toBe("人工名稱");
    expect(result.events[0]?.source).toBe("manual");
  });

  it("GitHub Models 不可用時使用中文分類加英文原名", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const result = await localizeEvents([unknown], {}, new Map(), names, {});
    expect(result.events[0]?.source).toBe("fallback");
    expect(result.events[0]?.title).toBe("遊戲活動｜Starlight Research Celebration");
  });

  it("翻譯快取命中且更新最後使用時間", async () => {
    const key = translationCacheKey(unknown);
    const cache: TranslationCache = {
      [key]: {
        original: unknown.name,
        translation: "星光研究慶典",
        source: "github-models",
        model: "openai/gpt-4.1-mini",
        createdAt: "2026-07-01T00:00:00.000Z",
        lastUsedAt: "2026-07-01T00:00:00.000Z",
      },
    };
    const result = await localizeEvents([unknown], {}, new Map(), names, cache);
    expect(result.events[0]?.source).toBe("model");
    expect(result.events[0]?.title).toBe("星光研究慶典");
    expect(result.cache[key]?.lastUsedAt).not.toBe(cache[key]?.lastUsedAt);
  });
});
