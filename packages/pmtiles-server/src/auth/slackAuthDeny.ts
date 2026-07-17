/**
 * Slack alerts for ACL denials on TileJSON, downloads, FGB/GeoJSON, and
 * /properties — not ZXY tiles. Rapid denials for the same object are
 * coalesced in-isolate before posting.
 */
import type { AuthDecision } from "./types";
import type { ResourceDescriptor } from "../resource";

export type AuthDenyNotifyKind =
  | "tilejson"
  | "download"
  | "fgb"
  | "geojson"
  | "properties";

export type AuthDenySlackEvent = {
  ns: string;
  kind: AuthDenyNotifyKind;
  slug: string;
  /** Published overlay UUID when available; otherwise null. */
  uuid: string | null;
  /** R2 / object key (dataset key for /properties). */
  objectKey: string;
  /** Credential-stripped request URL for humans. */
  objectUrl: string;
  decision: AuthDecision;
  tokenType: "map-access" | "overlay-engine" | null;
};

const TILE_ZXY =
  /\/\d+\/\d+\/\d+\.(?:mvt|pbf|png|webp|jpe?g)$/i;
const PUBLISHED_TILEJSON =
  /^projects\/[^/]+\/public\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:\.json)?$/i;

/** Burst window: collapse rapid denials for the same object into one post. */
export const AUTH_DENY_SLACK_COALESCE_MS = 3_000;
/** After a post, suppress further posts for the same coalesce key. */
export const AUTH_DENY_SLACK_COOLDOWN_MS = 60_000;

type PendingDeny = {
  count: number;
  event: AuthDenySlackEvent;
  timer: ReturnType<typeof setTimeout> | null;
  flushPromise: Promise<void> | null;
  cooldownUntil: number;
};

const pendingByKey = new Map<string, PendingDeny>();

/** Test helper — clear in-memory coalesce state. */
export function __resetAuthDenySlackStateForTests(): void {
  for (const entry of pendingByKey.values()) {
    if (entry.timer) clearTimeout(entry.timer);
  }
  pendingByKey.clear();
}

function isProjectOwned(resource: ResourceDescriptor): boolean {
  return (
    resource.kind === "published" ||
    resource.kind === "subdivided" ||
    resource.kind === "project_other"
  );
}

/**
 * Whether this denied request should page Slack (tiles are excluded).
 */
export function classifyAuthDenyNotifyTarget(
  pathname: string,
  searchParams: URLSearchParams,
  resource: ResourceDescriptor,
): AuthDenyNotifyKind | null {
  if (!isProjectOwned(resource)) return null;

  if (pathname === "/properties" || pathname === "/properties/") {
    return "properties";
  }

  if (TILE_ZXY.test(resource.key)) return null;

  if (searchParams.has("download")) return "download";

  const key = resource.key.toLowerCase();
  if (key.endsWith(".fgb")) return "fgb";
  if (key.endsWith(".geojson") || key.endsWith(".geojson.json")) {
    return "geojson";
  }

  if (resource.kind === "published" && PUBLISHED_TILEJSON.test(resource.key)) {
    return "tilejson";
  }

  return null;
}

/** Strip secrets from a URL before putting it in Slack. */
export function redactObjectUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("access_token");
    // Keep ns — useful for rollout debugging; not a secret.
    return u.toString();
  } catch {
    return url;
  }
}

export function authDenyCoalesceKey(event: AuthDenySlackEvent): string {
  const id = event.uuid || event.objectKey;
  return `${event.ns}|${event.slug}|${id}|${event.kind}|${event.decision.reason}`;
}

function slackEnabled(env: Env): boolean {
  if (!env.SLACK_WEBHOOK_URL) return false;
  if (String(env.AUTH_DENY_SLACK_ENABLED).toLowerCase() === "false") {
    return false;
  }
  return true;
}

function formatSlackText(event: AuthDenySlackEvent, count: number): string {
  const countNote = count > 1 ? ` (${count} denials in burst)` : "";
  const uuidLine = event.uuid ? `\n*uuid:* \`${event.uuid}\`` : "";
  return (
    `*Overlay ACL deny*${countNote}\n` +
    `*kind:* ${event.kind} · *status:* ${event.decision.status} · *reason:* \`${event.decision.reason}\`\n` +
    `*project:* \`${event.slug}\` · *ns:* \`${event.ns}\`` +
    uuidLine +
    `\n*object:* \`${event.objectKey}\`\n` +
    `*url:* ${event.objectUrl}\n` +
    `*hadToken:* ${event.decision.hadToken}` +
    (event.tokenType ? ` · *tokenType:* ${event.tokenType}` : "") +
    (event.decision.role ? ` · *role:* ${event.decision.role}` : "")
  );
}

async function postSlackWebhook(
  webhookUrl: string,
  text: string,
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      JSON.stringify({
        msg: "auth-deny-slack-failed",
        status: res.status,
        body: body.slice(0, 200),
      }),
    );
  }
}

async function flushPending(key: string, env: Env): Promise<void> {
  const entry = pendingByKey.get(key);
  if (!entry) return;
  entry.timer = null;
  const { event, count } = entry;
  entry.cooldownUntil = Date.now() + AUTH_DENY_SLACK_COOLDOWN_MS;
  entry.count = 0;
  const webhook = env.SLACK_WEBHOOK_URL;
  if (!webhook) return;
  await postSlackWebhook(webhook, formatSlackText(event, count));
}

/**
 * Schedule a coalesced Slack notification for an ACL denial. No-op when the
 * webhook is unset, disabled, or the path is not notify-worthy.
 */
export function scheduleAuthDenySlackNotification(
  env: Env,
  event: AuthDenySlackEvent,
  waitUntil?: (promise: Promise<unknown>) => void,
): void {
  if (!slackEnabled(env)) return;

  const key = authDenyCoalesceKey(event);
  const now = Date.now();
  let entry = pendingByKey.get(key);

  if (!entry) {
    entry = {
      count: 0,
      event,
      timer: null,
      flushPromise: null,
      cooldownUntil: 0,
    };
    pendingByKey.set(key, entry);
  }

  entry.event = event;
  entry.count += 1;

  if (entry.cooldownUntil > now && !entry.timer) {
    // Still in post-send cooldown; keep count for a follow-up window.
    if (!entry.flushPromise) {
      const delay = entry.cooldownUntil - now;
      entry.flushPromise = new Promise<void>((resolve) => {
        entry!.timer = setTimeout(() => {
          void flushPending(key, env)
            .catch((err) => {
              console.error(
                JSON.stringify({
                  msg: "auth-deny-slack-error",
                  error: err instanceof Error ? err.message : String(err),
                }),
              );
            })
            .finally(() => {
              entry!.flushPromise = null;
              resolve();
            });
        }, delay);
      });
      waitUntil?.(entry.flushPromise);
    }
    return;
  }

  if (entry.timer) {
    // Already coalescing this burst.
    return;
  }

  entry.flushPromise = new Promise<void>((resolve) => {
    entry!.timer = setTimeout(() => {
      void flushPending(key, env)
        .catch((err) => {
          console.error(
            JSON.stringify({
              msg: "auth-deny-slack-error",
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        })
        .finally(() => {
          entry!.flushPromise = null;
          resolve();
        });
    }, AUTH_DENY_SLACK_COALESCE_MS);
  });
  waitUntil?.(entry.flushPromise);
}

/** Build + schedule from gateway deny path. */
export function maybeNotifyAuthDeny(args: {
  env: Env;
  request: Request;
  resource: ResourceDescriptor;
  ns: string;
  decision: AuthDecision;
  tokenType: "map-access" | "overlay-engine" | null;
  waitUntil?: (promise: Promise<unknown>) => void;
}): void {
  const { env, request, resource, ns, decision, tokenType, waitUntil } = args;
  if (decision.allowed) return;
  if (!isProjectOwned(resource)) return;

  const url = new URL(request.url);
  const kind = classifyAuthDenyNotifyTarget(
    url.pathname,
    url.searchParams,
    resource,
  );
  if (!kind) return;

  scheduleAuthDenySlackNotification(
    env,
    {
      ns,
      kind,
      slug: resource.slug,
      uuid: resource.kind === "published" ? resource.uuid : null,
      objectKey: resource.key,
      objectUrl: redactObjectUrl(url.toString()),
      decision,
      tokenType,
    },
    waitUntil,
  );
}
