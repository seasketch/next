import { describe, expect, it } from "vitest";
import { renderTokenPrompt } from "../src/tokenPrompt";
import { RequestTiming } from "../src/timing";

describe("token prompt", () => {
  it("renders a form that submits access_token", () => {
    const html = renderTokenPrompt({});
    expect(html).toContain('id="token-form"');
    expect(html).toContain('name="access_token"');
    expect(html).toContain('searchParams.set("access_token", token)');
  });

  it("escapes token errors before inserting them into HTML", () => {
    const html = renderTokenPrompt({
      hadToken: true,
      error: '<script>alert("xss")</script>',
    });
    expect(html).toContain(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
    );
    expect(html).not.toContain('<script>alert("xss")</script>');
  });
});

describe("Server-Timing formatting", () => {
  it("reports total, R2 count, decompression, and significant stages", () => {
    const timing = new RequestTiming();
    timing.addStage("total", 12.345);
    timing.addStage("header", 2.25);
    timing.addStage("tile", 0.1);
    timing.recordR2(4);
    timing.recordR2(5);
    timing.recordPrefixCacheHit();
    timing.recordDecompress(1.6);

    expect(timing.toHeader()).toBe(
      'total;dur=12.3;desc="r2=2, prefix-cache=1, decompress=2ms", header;dur=2.3'
    );
  });

  it("returns an empty header when no timing was recorded", () => {
    expect(new RequestTiming().toHeader()).toBe("");
  });
});
