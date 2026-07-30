import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractOfficialTitle, resolveOfficialTranslations } from "../src/official-zh.js";
import type { RawEvent } from "../src/types.js";

const fixtureDir = path.resolve(import.meta.dirname, "fixtures");
const event: RawEvent = {
  eventID: "gigantamax-rillaboom-max-battle-day-2026",
  name: "Gigantamax Rillaboom Max Battle Day",
  eventType: "max-battles",
  heading: "Max Battles",
  link: "https://leekduck.com/events/gigantamax-rillaboom-max-battle-day-2026/",
  start: "2026-08-01T14:00:00.000",
  end: "2026-08-01T17:00:00.000",
  extraData: {},
};

describe("官方繁中頁面", () => {
  it("忽略宣傳 H1 並擷取正式活動 H2", async () => {
    const html = await readFile(path.join(fixtureDir, "official-success.html"), "utf8");
    const result = extractOfficialTitle(
      html,
      event,
      "https://pokemongo.com/zh-Hant/news/gigantamax-rillaboom-max-battle-day-2026",
    );
    expect(result?.title).toBe("超極巨化轟擂金剛猩極巨對戰日");
    expect(result?.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("排除活動詳情等章節標題", () => {
    const html = "<body><p>2026年</p><h2>活動詳情</h2><h2>可遇見的寶可夢</h2></body>";
    expect(extractOfficialTitle(html, event)).toBeUndefined();
  });

  it("404 只快取 24 小時語意且不產生標題", async () => {
    const result = await resolveOfficialTranslations([event], {}, {
      fetchPage: async (url) => ({ status: 404, html: "", finalUrl: url }),
    });
    expect(result.entries.size).toBe(0);
    expect(result.cache[event.eventID]?.found).toBe(false);
  });
});
