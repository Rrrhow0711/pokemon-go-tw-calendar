import { afterEach, describe, expect, it, vi } from "vitest";
import { translateWithGitHubModels } from "../src/github-models.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitHub Models", () => {
  it("驗證成功的結構化回應", async () => {
    const key = "a".repeat(64);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    translations: [{ key, translation: "星光研究慶典" }],
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const result = await translateWithGitHubModels(
      [{ key, name: "Starlight Research Celebration", eventType: "event" }],
      "test-token",
      "openai/gpt-4.1-mini",
    );
    expect(result.translations.get(key)).toBe("星光研究慶典");
  });

  it("限流時拋出可供上層降級的錯誤", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    await expect(
      translateWithGitHubModels(
        [{ key: "b".repeat(64), name: "Unknown", eventType: "event" }],
        "test-token",
      ),
    ).rejects.toThrow("HTTP 429");
  });
});
