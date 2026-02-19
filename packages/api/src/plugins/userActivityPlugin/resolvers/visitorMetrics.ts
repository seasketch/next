import { fetchVisitorMetrics } from "../cloudflare/metrics";
import { UserActivityPeriod } from "../cloudflare/client";

export async function resolveVisitorMetrics(
  parent: { period: UserActivityPeriod; slug?: string },
  _args: any,
  _context: any,
  _info: any
) {
  return fetchVisitorMetrics(parent.period, parent.slug);
}
