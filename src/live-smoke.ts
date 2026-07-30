import { SOURCE_URL } from "./config.js";
import { fetchEvents } from "./fetch-events.js";
import { fetchWithPolicy } from "./network.js";
import { OFFICIAL_ALLOWLIST } from "./config.js";

const source = await fetchEvents();
if (source.events.length === 0) throw new Error("live smoke test：ScrapedDuck 沒有有效活動");

const sample = source.events[0];
if (!sample) throw new Error("live smoke test：無法取得樣本活動");
const officialUrl = `https://pokemongo.com/zh-Hant/news/${encodeURIComponent(sample.eventID)}`;
const official = await fetchWithPolicy(officialUrl, {
  allowedHosts: OFFICIAL_ALLOWLIST,
  timeoutMs: 10_000,
  retries: 1,
});
if (official.status >= 500) {
  throw new Error(`live smoke test：官方網站回傳 HTTP ${official.status}`);
}

console.log(
  JSON.stringify({
    ok: true,
    sourceUrl: SOURCE_URL,
    validEventCount: source.events.length,
    sampleEventID: sample.eventID,
    officialProbeStatus: official.status,
  }),
);
