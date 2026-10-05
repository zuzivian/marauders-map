import { afterEach, describe, expect, it, vi } from "vitest";

// track() reads meta.analytics, so load it fresh against each setting.
async function withAnalytics(analytics: { kind: "goatcounter"; code: string } | null) {
  vi.resetModules();
  vi.doMock("@/data", () => ({ meta: { analytics } }));
  const count = vi.fn();
  vi.stubGlobal("window", { goatcounter: { count } });
  return { ...(await import("./analytics")), count };
}

describe("analytics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("@/data");
  });

  it("does nothing when meta.analytics is null", async () => {
    const { track, count } = await withAnalytics(null);
    track("copy-link/google");
    expect(count).not.toHaveBeenCalled();
  });

  it("sends GoatCounter events when on", async () => {
    const { track, count } = await withAnalytics({ kind: "goatcounter", code: "marauders" });
    track("select/google", "Picked a company");
    expect(count).toHaveBeenCalledWith({ path: "select/google", title: "Picked a company", event: true });
  });

  it("holds events until the script has loaded", async () => {
    const { track, flush } = await withAnalytics({ kind: "goatcounter", code: "marauders" });
    const late = vi.fn();
    vi.stubGlobal("window", { goatcounter: {} });
    track("useful/yes");
    window.goatcounter!.count = late;
    flush();
    expect(late).toHaveBeenCalledWith({ path: "useful/yes", title: "useful/yes", event: true });
  });
});
