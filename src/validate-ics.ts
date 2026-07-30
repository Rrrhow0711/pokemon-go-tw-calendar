import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import ICAL from "ical.js";

export interface IcsValidationResult {
  eventCount: number;
  uids: string[];
}

export function validateIcs(content: string): IcsValidationResult {
  if (!content.includes("\r\n")) throw new Error("ICS 必須使用 CRLF");
  if (content.replace(/\r\n/gu, "").includes("\n")) throw new Error("ICS 含有非 CRLF 換行");
  for (const line of content.split("\r\n")) {
    if (Buffer.byteLength(line, "utf8") > 75) {
      throw new Error(`ICS 實體行超過 75 octets：${line.slice(0, 40)}`);
    }
  }

  const parsed = ICAL.parse(content) as unknown;
  const component = new ICAL.Component(parsed as never);
  const events = component.getAllSubcomponents("vevent");
  const uids = events.map((event) => {
    const uid = event.getFirstPropertyValue("uid");
    if (typeof uid !== "string" || uid.length === 0) throw new Error("VEVENT 缺少 UID");
    return uid;
  });
  if (new Set(uids).size !== uids.length) throw new Error("ICS 含有重複 UID");
  return { eventCount: events.length, uids };
}

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("用法：tsx src/validate-ics.ts <calendar.ics>");
  const result = validateIcs(await readFile(filePath, "utf8"));
  console.log(`ICS 驗證成功：${result.eventCount} 筆 VEVENT，UID 無重複，CRLF/折行正確。`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
