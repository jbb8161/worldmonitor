// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { summarizeArticle } from "../worldmonitor/news/v1/summarize-article";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
}

function makeContext(headers: Record<string, string> = {}) {
  return {
    request: new Request("https://www.worldmonitor.app/api/news/v1/summarize-article", { headers }),
    pathParams: {},
    headers,
  };
}

function request(mode = "brief") {
  return {
    provider: "groq",
    headlines: ["Headline one", "Headline two"],
    mode,
    geoContext: "",
    variant: "full",
    lang: "en",
    systemAppend: "",
    bodies: [],
  };
}

beforeEach(() => {
  restoreEnv();
  process.env.GROQ_API_KEY = "test-groq-key";
  globalThis.fetch = vi.fn(async () => {
    throw new Error("non-premium summarize should not call providers");
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
});

describe("summarizeArticle handler premium mode gate", () => {
  test("anonymous article summaries are rejected before provider fetch", async () => {
    const result = await summarizeArticle(makeContext(), request("brief"));

    expect(result).toMatchObject({
      summary: "",
      fallback: true,
      error: "Pro subscription required",
      errorType: "AuthError",
      status: "SUMMARIZE_STATUS_ERROR",
      statusDetail: "Pro subscription required",
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("anonymous analysis mode is rejected before provider fetch", async () => {
    const result = await summarizeArticle(makeContext({ "X-WorldMonitor-Key": "wms_basic_session" }), request("analysis"));

    expect(result.error).toBe("Pro subscription required");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("translation mode remains outside the premium summary gate", async () => {
    delete process.env.GROQ_API_KEY;

    const result = await summarizeArticle(makeContext(), request("translate"));

    expect(result).toMatchObject({
      fallback: true,
      status: "SUMMARIZE_STATUS_SKIPPED",
      statusDetail: "GROQ_API_KEY not configured",
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("premium callers pass the summary gate", async () => {
    delete process.env.GROQ_API_KEY;
    process.env.WORLDMONITOR_VALID_KEYS = "enterprise-test-key";

    const result = await summarizeArticle(
      makeContext({ "X-WorldMonitor-Key": "enterprise-test-key" }),
      request("brief"),
    );

    expect(result).toMatchObject({
      fallback: true,
      status: "SUMMARIZE_STATUS_SKIPPED",
      statusDetail: "GROQ_API_KEY not configured",
    });
    expect(result.error).not.toBe("Pro subscription required");
  });
});

describe("summarizeArticle handler — AUSPEX self-host premium bypass", () => {
  test("anonymous AUSPEX request bypasses the gate when Clerk/Convex are both unconfigured", async () => {
    delete process.env.GROQ_API_KEY;

    const result = await summarizeArticle(makeContext(), { ...request("brief"), variant: "auspex" });

    // Reaches provider dispatch (skipped for missing credentials) instead of
    // being rejected for lacking a Pro subscription.
    expect(result).toMatchObject({
      fallback: true,
      status: "SUMMARIZE_STATUS_SKIPPED",
      statusDetail: "GROQ_API_KEY not configured",
    });
    expect(result.error).not.toBe("Pro subscription required");
  });

  test("AUSPEX request still requires premium when CLERK_SECRET_KEY is configured", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_clerk_configured";

    const result = await summarizeArticle(makeContext(), { ...request("brief"), variant: "auspex" });

    expect(result.error).toBe("Pro subscription required");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("AUSPEX request still requires premium when the Convex entitlement backend is configured", async () => {
    process.env.CONVEX_SITE_URL = "https://example.convex.site";
    process.env.CONVEX_SERVER_SHARED_SECRET = "convex-shared-secret";

    const result = await summarizeArticle(makeContext(), { ...request("brief"), variant: "auspex" });

    expect(result.error).toBe("Pro subscription required");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("non-AUSPEX variants are unaffected by the self-host bypass even when Clerk/Convex are unconfigured", async () => {
    const result = await summarizeArticle(makeContext(), { ...request("brief"), variant: "full" });

    expect(result.error).toBe("Pro subscription required");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
