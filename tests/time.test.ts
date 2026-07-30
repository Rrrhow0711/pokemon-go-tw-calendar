import { describe, expect, it } from "vitest";
import { formatIcsDate, formatIcsLocal, parseEventTime } from "../src/time.js";

describe("Asia/Taipei 時區", () => {
  it("無時區 ISO 視為台灣牆上時間，不多加 8 小時", () => {
    const parsed = parseEventTime(
      "2026-07-30T18:00:00.000",
      "2026-07-30T19:00:00.000",
    );
    expect(formatIcsLocal(parsed.start)).toBe("20260730T180000");
    expect(parsed.start.offset).toBe(480);
  });

  it("UTC 時間正確轉為台灣時間", () => {
    const parsed = parseEventTime(
      "2026-08-20T02:00:00.000Z",
      "2026-08-20T04:00:00.000Z",
    );
    expect(formatIcsLocal(parsed.start)).toBe("20260820T100000");
    expect(formatIcsLocal(parsed.end)).toBe("20260820T120000");
  });

  it("全天活動 DTEND 是結束日下一天的排他日期", () => {
    const single = parseEventTime("2026-08-01", "2026-08-01");
    expect(single.allDay).toBe(true);
    expect(formatIcsDate(single.end)).toBe("20260802");

    const range = parseEventTime("2026-08-01", "2026-08-03");
    expect(formatIcsDate(range.end)).toBe("20260804");
  });
});
