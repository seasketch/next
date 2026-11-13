import { Response } from "express";
import authorizationMiddleware from "../middleware/authorizationMiddleware";
import { IncomingRequest } from "../middleware/IncomingRequest";
import userAccountMiddleware from "../middleware/userAccountMiddleware";
import { CatalogUser } from "./types";

/**
 * Reads the caller's access token the same way the GraphQL API does.
 * A missing or invalid token is an anonymous caller.
 */
export function authenticateRequest(
  req: IncomingRequest,
  res: Response
): Promise<CatalogUser | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (user: CatalogUser | null) => {
      if (!settled) {
        settled = true;
        resolve(user);
      }
    };
    const fail = (error: unknown) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };
    try {
      authorizationMiddleware(req, res, (error?: unknown) => {
        if (error) {
          const code = (error as { code?: string }).code;
          if (code === "invalid_token") {
            finish(null);
            return;
          }
          fail(error);
          return;
        }
        userAccountMiddleware(req, res, (accountError?: unknown) => {
          if (accountError) {
            fail(accountError);
            return;
          }
          if (!req.user?.id) {
            finish(null);
            return;
          }
          finish({
            id: req.user.id,
            superuser: !!req.user.superuser,
            emailVerified: !!req.user.emailVerified,
          });
        });
      });
    } catch (error) {
      fail(error);
    }
  });
}
