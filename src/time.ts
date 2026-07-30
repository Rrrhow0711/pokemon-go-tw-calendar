import { DateTime } from "luxon";
import { TIME_ZONE } from "./config.js";

export interface ParsedEventTime {
  allDay: boolean;
  start: DateTime;
  end: DateTime;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/u;
const EXPLICIT_ZONE = /(?:Z|[+-]\d{2}:\d{2})$/iu;

export function parseEventTime(startValue: string, endValue: string): ParsedEventTime {
  const allDay = DATE_ONLY.test(startValue) && DATE_ONLY.test(endValue);
  if (allDay) {
    const start = DateTime.fromISO(startValue, { zone: TIME_ZONE });
    const rawEnd = DateTime.fromISO(endValue, { zone: TIME_ZONE });
    ensureValid(start, startValue);
    ensureValid(rawEnd, endValue);
    const end = rawEnd.plus({ days: 1 });
    if (end <= start) {
      throw new Error(`全天活動結束日期必須不早於開始日期：${startValue} → ${endValue}`);
    }
    return { allDay: true, start: start.startOf("day"), end: end.startOf("day") };
  }

  const start = parseInstantOrLocal(startValue);
  const end = parseInstantOrLocal(endValue);
  if (end <= start) {
    throw new Error(`活動結束時間必須晚於開始時間：${startValue} → ${endValue}`);
  }
  return { allDay: false, start, end };
}

function parseInstantOrLocal(value: string): DateTime {
  const dateTime = EXPLICIT_ZONE.test(value)
    ? DateTime.fromISO(value, { setZone: true }).setZone(TIME_ZONE)
    : DateTime.fromISO(value, { zone: TIME_ZONE, setZone: true });
  ensureValid(dateTime, value);
  return dateTime;
}

function ensureValid(dateTime: DateTime, source: string): void {
  if (!dateTime.isValid) {
    throw new Error(`無效時間 ${source}：${dateTime.invalidExplanation ?? "未知原因"}`);
  }
}

export function formatTaipeiDisplay(dateTime: DateTime, allDay = false): string {
  return allDay ? dateTime.toFormat("yyyy/LL/dd") : dateTime.toFormat("yyyy/LL/dd HH:mm");
}

export function formatIcsLocal(dateTime: DateTime): string {
  return dateTime.setZone(TIME_ZONE).toFormat("yyyyLLdd'T'HHmmss");
}

export function formatIcsDate(dateTime: DateTime): string {
  return dateTime.setZone(TIME_ZONE).toFormat("yyyyLLdd");
}

export function formatUtcStamp(dateTime: DateTime = DateTime.utc()): string {
  return dateTime.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
}
