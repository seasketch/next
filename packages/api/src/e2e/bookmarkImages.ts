import express, { Request, Response } from "express";
import { e2eBookmarkImage } from "../screenshotterClient";
import { isE2ETestModeEnabled } from "./testMode";

/**
 * Serves bookmark PNGs captured during test mode.
 * The client still builds `${REACT_APP_CLOUDFLARE_IMAGES_ENDPOINT}${id}/public`.
 * The e2e client points that prefix here, so the forum can show the capture
 * without writing to Cloudflare Images.
 */
export function registerE2EBookmarkImageRoute(
  app: Pick<express.Express, "get">
): boolean {
  if (!isE2ETestModeEnabled()) {
    return false;
  }
  app.get(
    "/e2e/bookmark-images/:id/:variant",
    (req: Request, res: Response) => {
      const variant = req.params.variant;
      if (variant !== "public" && variant !== "thumbnail") {
        res.status(404).end();
        return;
      }
      const png = e2eBookmarkImage(String(req.params.id));
      if (!png) {
        res.status(404).end();
        return;
      }
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      res.end(Buffer.from(png));
    }
  );
  return true;
}
