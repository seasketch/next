import { fetchVisitors } from "../cloudflare/visitors";
import { UserActivityPeriod } from "../cloudflare/client";

type VisitorsResult = ReturnType<typeof fetchVisitors>;

export async function resolveVisitors(
  parent: { period: UserActivityPeriod; slug?: string; _visitorsPromise?: VisitorsResult },
  _args: any,
  _context: any,
  _info: any
) {
  if (!parent._visitorsPromise) {
    parent._visitorsPromise = fetchVisitors(parent.period, parent.slug);
  }
  const { visitors } = await parent._visitorsPromise;
  return visitors;
}
