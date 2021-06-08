import { Response } from "express";
import { IncomingRequest } from "./IncomingRequest";
import { IncomingHttpHeaders } from "http";
import * as cache from "../cache";
import pool from "../pool";
import { Pool } from "pg";

/**
 * Populates req.projectId from request headers.
 *
 * The GraphQL api returns responses to queries such as currentProject using the
 * `x-ss-slug` header. It's also perfectly valid to make requests with no
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
  // @ts-ignore
  const slug = getSlug(req.headers, req.connectionParams);
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

function getSlug(
  headers: IncomingHttpHeaders,
  connectionParams?: IncomingHttpHeaders
) {
  const headerValue =
    // http requests
    headers["x-ss-slug"] ||
    // websockets
    (connectionParams && connectionParams["x-ss-slug"]);
  if (headerValue) {
    return Array.isArray(headerValue) ? headerValue[0] : headerValue;
  }
}

async function getProjectIdFromSlug(slug: string): Promise<number | undefined> {
  const key = `pid-by-slug:${slug}`;
  let id = await cache.get(key);
  if (id) {
    return parseInt(id);
  } else {
    const results = await pool.query(`select get_project_id($1) as id`, [slug]);
    if (results.rowCount === 0) {
      throw new Error(`Session error. Unknown project ${slug}`);
    } else {
      await cache.set(key, results.rows[0].id);
      return results.rows[0].id;
    }
  }
}
