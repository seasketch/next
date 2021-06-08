import { Response } from "express";
import { IncomingRequest } from "./IncomingRequest";
import * as cache from "../cache";
import pool from "../pool";

async function getOrCreateUserId(
  sub: string,
  canonicalEmail: string
): Promise<number> {
  const results = await pool.query(`select get_or_create_user_by_sub($1, $2)`, [
    sub,
    canonicalEmail,
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
    if (!req.user["https://seasketch.org/canonical_email"]) {
      throw new Error(
        "https://seasketch.org/canonical_email property not supplied in auth token"
      );
    }
    req.user.canonicalEmail = req.user["https://seasketch.org/canonical_email"];
    req.user.superuser = !!req.user["https://seasketch.org/superuser"];

    req.user.emailVerified = !!req.user["https://seasketch.org/email_verified"];
    const key = `userid-by-sub:${req.user.sub}`;
    cache.get(key).then((userId) => {
      if (!req.user) {
        throw new Error("req.user unset after cache.get");
      }
      if (userId) {
        req.user.id = parseInt(userId);
        next();
      } else {
        getOrCreateUserId(req.user.sub, req.user.canonicalEmail!)
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
