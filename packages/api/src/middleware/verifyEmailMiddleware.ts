import { Response } from "express";
import { IncomingRequest } from "./IncomingRequest";

export default function verifyEmailMiddleware(
  req: IncomingRequest,
  res: Response,
  next: Function
) {
  if (req.user) {
    req.user.emailVerified =
      !!req.user.emailVerified ||
      !!req.user["https://seasketch.org/email_verified"];
  }
  next();
}
