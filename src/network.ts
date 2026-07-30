import { setTimeout as delay } from "node:timers/promises";
import { USER_AGENT } from "./config.js";

export interface FetchPolicy {
  allowedHosts: ReadonlySet<string>;
  timeoutMs?: number;
  retries?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
}

export async function fetchWithPolicy(input: string, policy: FetchPolicy): Promise<Response> {
  const retries = policy.retries ?? 2;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchFollowingAllowedRedirects(input, policy);
      if (response.status >= 500 || response.status === 429) {
        throw new Error(`遠端服務回傳 HTTP ${response.status}`);
      }
      return response;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        const waitMs = 400 * 2 ** attempt + Math.floor(Math.random() * 100);
        await delay(waitMs);
      }
    }
  }

  throw lastError ?? new Error("網路請求失敗");
}

async function fetchFollowingAllowedRedirects(
  input: string,
  policy: FetchPolicy,
): Promise<Response> {
  let current = validateAllowedUrl(input, policy.allowedHosts);
  const maxRedirects = policy.maxRedirects ?? 4;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(policy.timeoutMs ?? 10_000),
      headers: {
        Accept: "application/json, text/html;q=0.9, */*;q=0.1",
        "User-Agent": USER_AGENT,
        ...policy.headers,
      },
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      throw new Error("重新導向缺少 Location");
    }
    current = validateAllowedUrl(new URL(location, current).href, policy.allowedHosts);
  }

  throw new Error(`重新導向超過 ${maxRedirects} 次`);
}

export function validateAllowedUrl(input: string, allowedHosts: ReadonlySet<string>): URL {
  const url = new URL(input);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error(`拒絕未列入 allowlist 的網址：${url.origin}`);
  }
  if (url.username || url.password) {
    throw new Error("網址不得包含帳號或密碼");
  }
  return url;
}
