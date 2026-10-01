import jwt from "express-jwt";
import jwksRsa from "jwks-rsa";
import { Request, Response, NextFunction } from "express";
import pool from "../pool";
import {
  authenticateE2EToken,
  tokenIssuer,
} from "../e2e/accessToken";
import { E2E_ISSUER, isE2ETestModeEnabled } from "../e2e/testMode";

function readBearerToken(req: Request): string | undefined {
  if ("normalizedConnectionParams" in req) {
    // websocket connection
    // @ts-ignore
    return req.normalizedConnectionParams["authorization"]?.split("Bearer ")[1];
  }
  return (
    // @ts-ignore
    req.query["token"] || req.header("authorization")?.split("Bearer ")[1]
  );
}

/**
 * Validates Bearer Authorization header via auth0 and assigns claims to req.user.
 * Tokens minted by E2E_TEST_MODE are checked against the local jwks table and
 * only while that mode is enabled.
 */
const jwtCheck = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: process.env.JWKS_URI!,
  }),
  audience: process.env.JWT_AUD,
  issuer: process.env.JWT_ISS,
  algorithms: ["RS256"],
  credentialsRequired: false,
  getToken: (req) => readBearerToken(req as Request),
});

export default function authorizationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = readBearerToken(req);
  if (
    isE2ETestModeEnabled() &&
    token &&
    tokenIssuer(token) === E2E_ISSUER
  ) {
    authenticateE2EToken(pool, token)
      .then((claims) => {
        // express-jwt assigns the verified payload here.
        // @ts-ignore
        req.user = claims;
        next();
      })
      .catch((error) => {
        error.code = error.code || "invalid_token";
        next(error);
      });
    return;
  }
  return jwtCheck(req, res, next);
}
