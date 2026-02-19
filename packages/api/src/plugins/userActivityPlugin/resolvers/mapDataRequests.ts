import { fetchMapDataRequests } from "../cloudflare/mapDataRequests";
import { UserActivityPeriod } from "../cloudflare/client";

export async function resolveMapDataRequests(
  parent: { period: UserActivityPeriod; slug?: string },
  _args: any,
  _context: any,
  _info: any
) {
  return fetchMapDataRequests(parent.period, parent.slug);
}
