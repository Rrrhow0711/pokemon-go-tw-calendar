import path from "node:path";

export const ROOT_DIR = path.resolve(import.meta.dirname, "..");
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const PUBLIC_DIR = path.join(ROOT_DIR, "public");
export const FIXTURE_DIR = path.join(ROOT_DIR, "tests", "fixtures");

export const SOURCE_URL =
  "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.json";
export const TIME_ZONE = "Asia/Taipei";
export const DEFAULT_MODEL = "openai/gpt-4.1-mini";
export const USER_AGENT =
  "pokemon-go-tw-calendar/1.0 (+https://github.com; public non-commercial calendar)";

export const SOURCE_ALLOWLIST = new Set(["raw.githubusercontent.com"]);
export const OFFICIAL_ALLOWLIST = new Set(["pokemongo.com", "www.pokemongo.com", "pokemongolive.com", "www.pokemongolive.com"]);

export function resolveSiteBaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const explicit = environment.SITE_BASE_URL?.trim();
  if (explicit) {
    const parsed = new URL(explicit);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("SITE_BASE_URL 必須使用 http 或 https");
    }
    return parsed.href.endsWith("/") ? parsed.href : `${parsed.href}/`;
  }

  const repository = environment.GITHUB_REPOSITORY?.trim();
  if (repository && /^[\w.-]+\/[\w.-]+$/u.test(repository)) {
    const [owner, repo] = repository.split("/");
    return `https://${owner}.github.io/${repo}/`;
  }

  return "http://localhost:4173/";
}
