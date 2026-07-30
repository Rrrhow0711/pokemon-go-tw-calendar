import { describe, expect, it } from "vitest";
import { assertSourceHealthy, parseEvents } from "../src/fetch-events.js";

const validEvent = {
  eventID: "safe-event",
  name: "Safe <b>Event</b>",
  eventType: "event",
  heading: "Event",
  link: "https://leekduck.com/events/safe-event/",
  start: "2026-08-01T10:00:00.000",
  end: "2026-08-01T12:00:00.000",
  extraData: {},
};

describe("ScrapedDuck 資料驗證", () => {
  it("清除 HTML 並逐筆跳過不合法資料", () => {
    const result = parseEvents([
      validEvent,
      { ...validEvent, eventID: "bad", link: "javascript:alert(1)" },
    ]);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.name).toBe("Safe Event");
    expect(result.warnings).toHaveLength(1);
  });

  it("拒絕非 Leek Duck 活動連結", () => {
    const result = parseEvents([{ ...validEvent, link: "https://evil.example/event" }]);
    expect(result.events).toHaveLength(0);
  });

  it("去除重複 eventID", () => {
    const result = parseEvents([validEvent, validEvent]);
    expect(result.events).toHaveLength(1);
    expect(result.warnings[0]).toContain("重複");
  });

  it("0 筆資料時拒絕覆蓋", () => {
    expect(() => assertSourceHealthy(0, 20)).toThrow("0 筆");
  });

  it("資料筆數異常下降時拒絕覆蓋", () => {
    expect(() => assertSourceHealthy(4, 20, 0.5)).toThrow("異常下降");
    expect(() => assertSourceHealthy(10, 20, 0.5)).not.toThrow();
  });
});
