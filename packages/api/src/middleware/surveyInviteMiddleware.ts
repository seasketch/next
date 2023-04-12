import { Response } from "express";
import { IncomingRequest } from "./IncomingRequest";
import { verifySurveyInvite } from "../invites/surveyInvites";
import pool from "../pool";

const ISSUER = (process.env.ISSUER || "seasketch.org")
  .split(",")
  .map((issuer) => issuer.trim());
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
      verifySurveyInvite(pool, token, ISSUER)
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
