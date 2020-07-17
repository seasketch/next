import { Request } from "express";
import { SurveyInviteTokenClaims } from "../invites/surveyInvites";

type UserClaims = {
  /* auth0 user id */
  sub: string;
  /* seasketch db user id */
  id: number;
  emailVerified: boolean;
  /* email used to register for seasketch */
  canonicalEmail?: string;
  /* superuser privileges can be applied in the auth0 database for McClintock Lab staff */
  superuser: boolean;
  /* auth0 token includes arbitrary permissions */
  permissions?: string[];

  // auth0 rule engine embeds seasketch-specific fields
  /* email used to register for seasketch */
  "https://seasketch.org/canonical_email"?: string;
  /* email can be verified via the auth0 management api or through a UI */
  "https://seasketch.org/email_verified"?: boolean;
};

export interface IncomingRequest extends Request {
  /* Set by authorization middleware */
  user?: UserClaims;
  /* Set by currentProjectMiddleware */
  projectId?: number;
  surveyInvite?: SurveyInviteTokenClaims;
}
