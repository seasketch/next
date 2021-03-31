import { Response } from "express";
import { IncomingRequest } from "./IncomingRequest";
import { verifySurveyInvite } from "../invites/surveyInvites";
import pool from "../pool";
import { Pool } from "pg";

/**
 * Populates req.surveyInvite with survey invite token claims if present in the
 * `x-ss-survey-invite-token` header.
 *
 * @param {IncomingRequest} req
 * @param {Response} res
 * @param {Function} next
 */
export default function surveyInviteMiddlware(
  req: IncomingRequest,
  res: Response,
  next: Function
) {
  if (req.headers["x-ss-survey-invite-token"]) {
    const token = Array.isArray(req.headers["x-ss-survey-invite-token"])
      ? req.headers["x-ss-survey-invite-token"][0]
      : req.headers["x-ss-survey-invite-token"];
    // TODO: use redis cache at this point
    try {
      verifySurveyInvite(pool, token, process.env.HOST || "seasketch.org")
        .then((claims) => {
          req.surveyInvite = claims;
          next();
        })
        .catch((e) => {
          // fail silently, since acccess control is enforced seperately
          next();
        });
    } catch (e) {
      // fail silently, since acccess control is enforced seperately
      next();
    }
  } else {
    next();
  }
}
