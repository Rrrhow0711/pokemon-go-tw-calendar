import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { buildCalendar, escapeIcsText, foldIcsLine, makeUid } from "../src/ics.js";
import type { LocalizedEvent } from "../src/types.js";
import { validateIcs } from "../src/validate-ics.js";

function localized(overrides: Partial<LocalizedEvent> = {}): LocalizedEvent {
  return {
    event: {
      eventID: "fixture-event",
      name: "Fixture Event",
      eventType: "event",
      heading: "Event",
      link: "https://leekduck.com/events/fixture-event/",
      start: "2026-08-01T10:00:00.000",
      end: "2026-08-01T12:00:00.000",
      extraData: {},
    },
    title: "測試活動",
    originalTitle: "Fixture Event",
    category: "遊戲活動",
    source: "rule",
    ...overrides,
  };
}

describe("RFC 5545 ICS", () => {
  it("正確跳脫特殊字元", () => {
    expect(escapeIcsText("反\\斜線,逗號;分號\n換行")).toBe(
      "反\\\\斜線\\,逗號\\;分號\\n換行",
    );
  });

  it("UTF-8 中文折行不損毀且每行不超過 75 octets", () => {
    const source = `DESCRIPTION:${"繁體中文活動".repeat(30)}`;
    const folded = foldIcsLine(source);
    const unfolded = folded.replace(/\r\n /gu, "");
    expect(unfolded).toBe(source);
    for (const line of folded.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
  });

  it("使用 CRLF、穩定 UID 且可由 ical.js 重解析", () => {
    const generated = buildCalendar(
      [localized()],
      DateTime.fromISO("2026-07-30T00:00:00Z"),
    );
    expect(generated.content).toContain("\r\n");
    expect(generated.content.replace(/\r\n/gu, "")).not.toContain("\n");
    const validation = validateIcs(generated.content);
    expect(validation.eventCount).toBe(1);
    expect(validation.uids[0]).toBe("fixture-event@pokemon-go-tw-calendar");
  });

  it("相同活動更新後 UID 不變且重複輸入只產生一筆", () => {
    const first = makeUid("fixture-event");
    const second = makeUid("fixture-event");
    expect(first).toBe(second);
    const generated = buildCalendar([
      localized(),
      localized({ title: "更新名稱" }),
    ]);
    expect(generated.eventCount).toBe(1);
    expect(generated.warnings[0]).toContain("重複");
  });

  it("至少產生一筆繁體中文 VEVENT", () => {
    const generated = buildCalendar([localized()]);
    expect(generated.content).toContain("BEGIN:VEVENT");
    expect(generated.content.replace(/\r\n /gu, "")).toContain("SUMMARY:測試活動");
  });
});
