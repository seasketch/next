import express, { Request, Response } from "express";
import { DBClient } from "../dbClient";
import { issueE2EAccessToken } from "./accessToken";
import {
  E2E_SUB_PREFIX,
  E2E_TOKEN_TTL_SECONDS,
  e2ePassphraseMatches,
  isE2ESub,
  isE2ETestModeEnabled,
} from "./testMode";

/** Adds POST /e2e/token only while test mode is enabled. Returns whether it did. */
export function registerE2ETokenRoute(
  app: Pick<express.Express, "post">,
  client: DBClient
): boolean {
  if (!isE2ETestModeEnabled()) {
    return false;
  }
  app.post(
    "/e2e/token",
    express.json({ limit: "32kb" }) as any,
    e2eTokenRoute(client)
  );
  return true;
}

export function e2eTokenRoute(client: DBClient) {
  return async function e2eToken(req: Request, res: Response) {
    if (!e2ePassphraseMatches(req.body?.passphrase)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const sub = req.body?.sub;
    if (typeof sub !== "string" || sub.length === 0) {
      res.status(400).json({ error: "sub is required" });
      return;
    }
    if (!isE2ESub(sub)) {
      res
        .status(403)
        .json({ error: `test mode only signs in ${E2E_SUB_PREFIX} users` });
      return;
    }
    const { superuser, emailVerified } = req.body ?? {};
    if (superuser !== undefined && typeof superuser !== "boolean") {
      res.status(400).json({ error: "superuser must be a boolean" });
      return;
    }
    if (emailVerified !== undefined && typeof emailVerified !== "boolean") {
      res.status(400).json({ error: "emailVerified must be a boolean" });
      return;
    }
    try {
      const accessToken = await issueE2EAccessToken(client, sub, {
        superuser,
        emailVerified,
      });
      if (!accessToken) {
        res.status(404).json({ error: "unknown user" });
        return;
      }
      res.json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: E2E_TOKEN_TTL_SECONDS,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "could not issue token" });
    }
  };
}
