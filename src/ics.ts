import type { DateTime } from "luxon";
import { formatIcsDate, formatIcsLocal, formatTaipeiDisplay, formatUtcStamp, parseEventTime } from "./time.js";
import type { LocalizedEvent } from "./types.js";

const CALENDAR_NAME = "Pokémon GO 台灣活動";
const PRODID = "-//Pokemon GO Taiwan Calendar//ZH-TW//EN";

export interface CalendarBuildResult {
  content: string;
  eventCount: number;
  warnings: string[];
}

export function buildCalendar(
  events: LocalizedEvent[],
  generatedAt?: DateTime,
): CalendarBuildResult {
  const warnings: string[] = [];
  const seenUids = new Set<string>();
  const eventBlocks: string[] = [];

  for (const localized of events) {
    try {
      const uid = makeUid(localized.event.eventID);
      if (seenUids.has(uid)) {
        warnings.push(`UID ${uid} 重複，已跳過後續活動`);
        continue;
      }
      seenUids.add(uid);
      eventBlocks.push(buildEvent(localized, uid, generatedAt));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${localized.event.eventID} 無法產生 VEVENT：${message}`);
    }
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(CALENDAR_NAME)}`,
    "X-WR-TIMEZONE:Asia/Taipei",
    ...timeZoneLines(),
    ...eventBlocks.flatMap((block) => block.split("\r\n").filter(Boolean)),
    "END:VCALENDAR",
  ];

  return {
    content: `${lines.map(foldIcsLine).join("\r\n")}\r\n`,
    eventCount: eventBlocks.length,
    warnings,
  };
}

function buildEvent(localized: LocalizedEvent, uid: string, generatedAt?: DateTime): string {
  const { event } = localized;
  const timing = parseEventTime(event.start, event.end);
  const description = buildDescription(localized, timing.start, timing.end, timing.allDay);
  const url = localized.officialUrl ?? event.link;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatUtcStamp(generatedAt)}`,
    ...(timing.allDay
      ? [
          `DTSTART;VALUE=DATE:${formatIcsDate(timing.start)}`,
          `DTEND;VALUE=DATE:${formatIcsDate(timing.end)}`,
        ]
      : [
          `DTSTART;TZID=Asia/Taipei:${formatIcsLocal(timing.start)}`,
          `DTEND;TZID=Asia/Taipei:${formatIcsLocal(timing.end)}`,
        ]),
    `SUMMARY:${escapeIcsText(localized.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${url}`,
    `CATEGORIES:${escapeIcsText(localized.category)}`,
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
  return lines.join("\r\n");
}

function buildDescription(
  localized: LocalizedEvent,
  start: DateTime,
  end: DateTime,
  allDay: boolean,
): string {
  const displayEnd = allDay ? end.minus({ days: 1 }) : end;
  const lines = [
    localized.title,
    `英文原名：${localized.originalTitle}`,
    `活動分類：${localized.category}`,
    `台灣時間：${formatTaipeiDisplay(start, allDay)} ～ ${formatTaipeiDisplay(displayEnd, allDay)}`,
  ];
  if (localized.customDescription) lines.push(localized.customDescription);
  if (localized.officialUrl) lines.push(`官方繁中：${localized.officialUrl}`);
  lines.push(
    `Leek Duck 詳情：${localized.event.link}`,
    "資料來源：Pokémon GO 官方公告、Leek Duck、ScrapedDuck",
    "非 Pokémon GO 官方服務；免費、無廣告。",
  );
  return lines.join("\n");
}

export function makeUid(eventId: string): string {
  const safe = eventId.toLocaleLowerCase("en").replace(/[^a-z0-9._-]/gu, "-").slice(0, 200);
  if (!safe) throw new Error("eventID 無法形成有效 UID");
  return `${safe}@pokemon-go-tw-calendar`;
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/gu, "\\\\")
    .replace(/\r\n|\r|\n/gu, "\\n")
    .replace(/,/gu, "\\,")
    .replace(/;/gu, "\\;");
}

export function foldIcsLine(line: string): string {
  const cleanLine = line.replace(/\r|\n/gu, "");
  const chunks: string[] = [];
  let current = "";
  let limit = 75;

  for (const character of cleanLine) {
    const candidate = current + character;
    if (Buffer.byteLength(candidate, "utf8") > limit && current.length > 0) {
      const trailingSpaces = current.match(/ +$/u)?.[0] ?? "";
      const chunk = trailingSpaces ? current.slice(0, -trailingSpaces.length) : current;
      chunks.push(chunk);
      current = `${trailingSpaces}${character}`;
      limit = 74;
    } else {
      current = candidate;
    }
  }
  chunks.push(current);
  return chunks.join("\r\n ");
}

function timeZoneLines(): string[] {
  return [
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Taipei",
    "X-LIC-LOCATION:Asia/Taipei",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:CST",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
}
