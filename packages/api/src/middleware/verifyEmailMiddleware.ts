import { Response } from "express";
import { IncomingRequest } from "./IncomingRequest";
import { verifyEmail } from "../auth/auth0";

export default function verifyEmailMiddleware(
  req: IncomingRequest,
  res: Response,
  next: Function
) {
  if (req.user) {
    if (req.user["https://seasketch.org/email_verified"]) {
      req.user.emailVerified = true;
      next();
    } else {
      // TODO: use redis to skip auth0 step if already done recently
      if (
        req.surveyInvite &&
        req.user &&
        req.surveyInvite.email === req.user.canonicalEmail
      ) {
        // If a survey invite token is present, we know that the user followed
        // an email into the app. If the invite email matches canonical_email,
        // we can automatically verify the account.
        verifyEmail(req.user.sub)
          .then(() => {
            req.user!.emailVerified = true;
            next();
          })
          .catch((e) => {
            // do nothing, since we can always try again later
            next();
          });
      } else {
        next();
      }
    }
  } else {
    next();
  }
}
