import { Response } from "express";
import pool from "../pool";
import { IncomingRequest } from "./IncomingRequest";
import * as cache from "../cache";

async function getOrCreateUserId(sub: string): Promise<number> {
  const results = await pool.query(`select get_or_create_user_by_sub($1)`, [
    sub,
  ]);
  if (results.rowCount === 0 || !results.rows[0].get_or_create_user_by_sub) {
    throw new Error(`Session error. Unknown user ${sub}`);
  } else {
    return results.rows[0].get_or_create_user_by_sub;
  }
}

/**
 * Normalize claims from authorization token and populates req.user.id from the
 * database.
 *
 * @param {IncomingRequest} req
 * @param {Response} res
 * @param {Function} next
 */
export default function userAccountMiddlware(
  req: IncomingRequest,
  res: Response,
  next: Function
) {
  // req.user could be assigned by authorizationMiddlware
  if (req.user) {
    // normalize claims
    if (req.user["https://seasketch.org/canonical_email"]) {
      req.user.canonicalEmail =
        req.user["https://seasketch.org/canonical_email"];
    }
    req.user.superuser =
      (req.user.permissions || []).indexOf("superuser") !== -1;

    req.user.emailVerified = !!req.user["https://seasketch.org/email_verified"];
    const key = `userid-by-sub:${req.user.sub}`;
    cache.get(key).then((userId) => {
      if (userId) {
        req.user!.id = parseInt(userId);
        next();
      } else {
        getOrCreateUserId(req.user!.sub)
          .then((id) => {
            req.user!.id = id;
            cache.set(key, id).then(() => next());
          })
          .catch((e) => next(e));
      }
    });
  } else {
    next();
  }
}
