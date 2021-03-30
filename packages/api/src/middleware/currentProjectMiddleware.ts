import { Response } from "express";
import { IncomingRequest } from "./IncomingRequest";
import { IncomingHttpHeaders } from "http";
import * as cache from "../cache";
import getPool from "../pool";
import { Pool } from "pg";

let pool: Pool;
getPool().then((p) => (pool = p));

/**
 * Populates req.projectId from request headers.
 *
 * The GraphQL api returns responses to queries such as currentProject using the
 * referrer url the request is made from, or the `x-ss-slug` header for
 * debugging purposes. It's also perfectly valid to make requests with no
 * project at all.
 *
 * @param {IncomingRequest} req
 * @param {Response} res
 * @param {Function} next
 */
export default function currentProjectMiddlware(
  req: IncomingRequest,
  res: Response,
  next: Function
) {
  const slug = getSlug(req.headers);
  if (slug) {
    getProjectIdFromSlug(slug)
      .then((projectId) => {
        req.projectId = projectId;
        next();
      })
      .catch((e) => {
        next(e);
      });
  } else {
    next();
  }
}

function getSlug(headers: IncomingHttpHeaders) {
  if (headers["x-ss-slug"]) {
    return Array.isArray(headers["x-ss-slug"])
      ? headers["x-ss-slug"][0]
      : headers["x-ss-slug"];
  } else if (headers["referer"]) {
    const url = new URL(headers["referer"]);
    if (/\/p\//.test(url.pathname)) {
      return url.pathname.split("/")[2];
    }
  }
}

async function getProjectIdFromSlug(slug: string): Promise<number | undefined> {
  const key = `pid-by-slug:${slug}`;
  let id = await cache.get(key);
  if (id) {
    return parseInt(id);
  } else {
    const results = await pool.query(
      `select id from projects where slug = $1`,
      [slug]
    );
    if (results.rowCount === 0) {
      throw new Error(`Session error. Unknown project ${slug}`);
    } else {
      await cache.set(key, results.rows[0].id);
      return results.rows[0].id;
    }
  }
}
