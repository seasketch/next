import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_DENY_SLACK_COALESCE_MS,
  AUTH_DENY_SLACK_COOLDOWN_MS,
  __resetAuthDenySlackStateForTests,
  classifyAuthDenyNotifyTarget,
  redactObjectUrl,
  scheduleAuthDenySlackNotification,
  type AuthDenySlackEvent,
} from "../src/auth/slackAuthDeny";
import { classifyResource } from "../src/resource";

const UUID = "cb5a5804-d8c7-4098-9f53-4ddcb6bf9ffe";

function decision(
  overrides: Partial<AuthDenySlackEvent["decision"]> = {},
): AuthDenySlackEvent["decision"] {
  return {
    allowed: false,
    status: 401,
    reason: "missing_token",
    aclClass: "admins_only",
    hadToken: false,
    role: null,
    groups: [],
    aclVersion: 1,
    ...overrides,
  };
}

function baseEvent(
  overrides: Partial<AuthDenySlackEvent> = {},
): AuthDenySlackEvent {
  return {
    ns: "prod",
    kind: "tilejson",
    slug: "belize",
    uuid: UUID,
    objectKey: `projects/belize/public/${UUID}.json`,
    objectUrl: `https://tiles.seasketch.org/projects/belize/public/${UUID}.json`,
    decision: decision(),
    tokenType: null,
    ...overrides,
  };
}

describe("classifyAuthDenyNotifyTarget", () => {
  it("classifies tilejson, download, fgb, geojson, properties", () => {
    const tilejson = classifyResource(
      `projects/belize/public/${UUID}.json`,
    )!;
    expect(
      classifyAuthDenyNotifyTarget(
        `/${tilejson.key}`,
        new URLSearchParams(),
        tilejson,
      ),
    ).toBe("tilejson");

    const bare = classifyResource(`projects/belize/public/${UUID}`)!;
    expect(
      classifyAuthDenyNotifyTarget(`/${bare.key}`, new URLSearchParams(), bare),
    ).toBe("tilejson");

    const fgb = classifyResource(
      `projects/belize/subdivided/12-${UUID}.fgb`,
    )!;
    expect(
      classifyAuthDenyNotifyTarget(`/${fgb.key}`, new URLSearchParams(), fgb),
    ).toBe("fgb");

    const geojson = classifyResource(
      `projects/belize/public/${UUID}.geojson.json`,
    )!;
    expect(
      classifyAuthDenyNotifyTarget(
        `/${geojson.key}`,
        new URLSearchParams(),
        geojson,
      ),
    ).toBe("geojson");

    expect(
      classifyAuthDenyNotifyTarget(
        "/properties",
        new URLSearchParams(`dataset=${fgb.key}`),
        fgb,
      ),
    ).toBe("properties");

    expect(
      classifyAuthDenyNotifyTarget(
        `/${fgb.key}`,
        new URLSearchParams("download=layer.fgb"),
        fgb,
      ),
    ).toBe("download");
  });

  it("ignores ZXY tiles and non-project resources", () => {
    const tile = classifyResource(
      `projects/belize/public/${UUID}/0/0/0.pbf`,
    )!;
    expect(
      classifyAuthDenyNotifyTarget(`/${tile.key}`, new URLSearchParams(), tile),
    ).toBeNull();

    const library = classifyResource(
      `projects/superuser/public/${UUID}.json`,
    )!;
    expect(
      classifyAuthDenyNotifyTarget(
        `/${library.key}`,
        new URLSearchParams(),
        library,
      ),
    ).toBeNull();
  });
});

describe("redactObjectUrl", () => {
  it("strips access_token but keeps ns", () => {
    const url =
      `https://tiles.seasketch.org/projects/belize/public/${UUID}.json` +
      `?access_token=secret&ns=prod`;
    expect(redactObjectUrl(url)).toBe(
      `https://tiles.seasketch.org/projects/belize/public/${UUID}.json?ns=prod`,
    );
  });
});

describe("scheduleAuthDenySlackNotification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetAuthDenySlackStateForTests();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok", { status: 200 })),
    );
  });

  afterEach(() => {
    __resetAuthDenySlackStateForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("coalesces rapid events into one Slack post with count", async () => {
    const env = {
      SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/test",
      AUTH_DENY_SLACK_ENABLED: "true",
    } as Env;

    scheduleAuthDenySlackNotification(env, baseEvent());
    scheduleAuthDenySlackNotification(env, baseEvent());
    scheduleAuthDenySlackNotification(env, baseEvent());

    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(AUTH_DENY_SLACK_COALESCE_MS);
    expect(fetch).toHaveBeenCalledTimes(1);

    const body = JSON.parse(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    expect(body.text).toContain("belize");
    expect(body.text).toContain("3 denials in burst");
    expect(body.text).toContain(
      `https://tiles.seasketch.org/projects/belize/public/${UUID}.json`,
    );
    expect(body.text).not.toContain("access_token");
  });

  it("no-ops when webhook missing or disabled", async () => {
    scheduleAuthDenySlackNotification({} as Env, baseEvent());
    scheduleAuthDenySlackNotification(
      {
        SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/test",
        AUTH_DENY_SLACK_ENABLED: "false",
      } as Env,
      baseEvent(),
    );
    await vi.advanceTimersByTimeAsync(
      AUTH_DENY_SLACK_COALESCE_MS + AUTH_DENY_SLACK_COOLDOWN_MS,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
