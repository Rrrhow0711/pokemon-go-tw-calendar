import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { buildPage, escapeHtml } from "../src/build-page.js";
import type { BuildStatus } from "../src/types.js";

const root = path.resolve(import.meta.dirname, "..");
const status: BuildStatus = {
  lastSuccessfulUpdate: "2026-07-30T00:00:00.000Z",
  sourceEventCount: 5,
  generatedEventCount: 5,
  officialTranslationCount: 1,
  ruleTranslationCount: 3,
  modelTranslationCount: 0,
  fallbackCount: 1,
  warnings: [],
  sourceUrl: "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.json",
  calendarUrl: "https://example.github.io/repo/pokemon-go-zh-TW.ics",
};

describe("靜態頁面與 workflow", () => {
  it("外部文字不會未轉義插入 HTML", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    const page = buildPage(status, "https://example.github.io/repo/<script>/");
    expect(page).not.toContain("<script>/pokemon-go");
    expect(page).toContain("%3Cscript%3E");
  });

  it("訂閱頁含必要按鈕、網址、移除步驟與聲明", () => {
    const page = buildPage(status, "https://example.github.io/repo/");
    expect(page).toContain("加入 Apple 行事曆");
    expect(page).toContain("複製訂閱網址");
    expect(page).toContain("webcal://example.github.io/repo/pokemon-go-zh-TW.ics");
    expect(page).toContain("已訂閱的行事曆");
    expect(page).toContain("非 Pokémon GO 官方服務");
  });

  it("GitHub Actions YAML 可解析且具備必要權限與觸發", async () => {
    const updateText = await readFile(
      path.join(root, ".github", "workflows", "update-calendar.yml"),
      "utf8",
    );
    const testText = await readFile(
      path.join(root, ".github", "workflows", "test.yml"),
      "utf8",
    );
    expect(() => {
      parse(updateText);
    }).not.toThrow();
    expect(() => {
      parse(testText);
    }).not.toThrow();
    expect(updateText).toContain("models: read");
    expect(updateText).toContain("pages: write");
    expect(updateText).toContain("workflow_dispatch");
    expect(updateText).toContain("cron:");
    expect(testText).toContain("pull_request");
  });
});
