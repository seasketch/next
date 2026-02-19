import { fetchVisitors } from "../cloudflare/visitors";
import { UserActivityPeriod } from "../cloudflare/client";

export async function resolveVisitors(
  parent: { period: UserActivityPeriod; slug?: string },
  _args: any,
  _context: any,
  _info: any
) {
  return fetchVisitors(parent.period, parent.slug);
}
