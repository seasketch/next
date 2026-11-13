import { Request, Response, Router } from "express";
import { passesLayerAccess } from "./access";
import {
  CatalogLayer,
  catalogCsv,
  catalogRecords,
  layerResourceUrl,
} from "./columns";
import { parseMetadataFormat, renderMetadata } from "./metadataDocument";
import { layersInOverlayOrder } from "./order";
import { CatalogUser, LayerCatalogStore, RawTocItem } from "./types";

type LoadComputedMetadata = (
  sourceType: string | null,
  url: string | null,
  sublayer: string | null
) => Promise<unknown>;

export type Authenticate = (
  req: Request,
  res: Response
) => Promise<CatalogUser | null>;

export function registerLayerCatalog(
  router: Router,
  options: {
    store: LayerCatalogStore;
    authenticate: Authenticate;
    loadComputedMetadata?: LoadComputedMetadata;
  }
) {
  const loadComputedMetadata =
    options.loadComputedMetadata || defaultLoadComputedMetadata;

  router.get("/:slug.csv", (req, res, next) => {
    sendCatalog(req, res, options.store, options.authenticate, "csv").catch(next);
  });
  router.get("/:slug.json", (req, res, next) => {
    sendCatalog(req, res, options.store, options.authenticate, "json").catch(next);
  });
  router.get("/:slug/:stableId/style", (req, res, next) => {
    sendResource(req, res, options.store, options.authenticate, "style", loadComputedMetadata).catch(
      next
    );
  });
  router.get("/:slug/:stableId/geostats", (req, res, next) => {
    sendResource(
      req,
      res,
      options.store,
      options.authenticate,
      "geostats",
      loadComputedMetadata
    ).catch(next);
  });
  router.get("/:slug/:stableId/metadata", (req, res, next) => {
    sendResource(
      req,
      res,
      options.store,
      options.authenticate,
      "metadata",
      loadComputedMetadata
    ).catch(next);
  });
}

async function sendCatalog(
  req: Request,
  res: Response,
  store: LayerCatalogStore,
  authenticate: Authenticate,
  format: "csv" | "json"
) {
  const slug = catalogSlug(req);
  if (!slug) {
    res.status(404).send("Not found");
    return;
  }
  const project = await store.projectBySlug(slug);
  if (!project) {
    res.status(404).send("Not found");
    return;
  }
  const user = await authenticate(req, res);
  if (res.headersSent) {
    return;
  }
  const isAdmin = await callerIsAdmin(store, project.id, user);
  if (!isAdmin) {
    res.status(user ? 403 : 401).send(user ? "Forbidden" : "Unauthorized");
    return;
  }
  const items = await store.draftItems(project.id);
  const layers = catalogLayers(items, requestOrigin(req), slug);
  res.set("Cache-Control", "private");
  res.set("Vary", "Authorization");
  if (format === "csv") {
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set(
      "Content-Disposition",
      `attachment; filename="${slug}-layers.csv"`
    );
    res.send(catalogCsv(layers));
    return;
  }
  res.json(catalogRecords(layers));
}

async function sendResource(
  req: Request,
  res: Response,
  store: LayerCatalogStore,
  authenticate: Authenticate,
  resource: "style" | "geostats" | "metadata",
  loadComputedMetadata: LoadComputedMetadata
) {
  const slug = req.params.slug;
  const stableId = req.params.stableId;
  const project = await store.projectBySlug(slug);
  if (!project) {
    res.status(404).send("Not found");
    return;
  }
  const user = await authenticate(req, res);
  if (res.headersSent) {
    return;
  }
  const isAdmin = await callerIsAdmin(store, project.id, user);
  const record = await store.layerResource(project.id, stableId, isAdmin);
  if (!record) {
    res.status(404).send("Not found");
    return;
  }
  const lists = await store.accessLists(project.id, isAdmin, record.path);
  const memberIds = new Set(
    user ? await store.memberAclIds(lists.map((list) => list.id), user.id) : []
  );
  const allowed = passesLayerAccess({
    isProjectAdmin: isAdmin,
    lists: lists.map((list) => ({
      type: list.type,
      member: memberIds.has(list.id),
    })),
  });
  if (!allowed) {
    res.status(user ? 403 : 401).send(user ? "Forbidden" : "Unauthorized");
    return;
  }
  res.set("Cache-Control", "private");
  res.set("Vary", "Authorization");
  if (resource === "style") {
    res.json(record.style ?? null);
    return;
  }
  if (resource === "geostats") {
    res.json(record.geostats ?? null);
    return;
  }
  const format = parseMetadataFormat(req.query.format);
  if (!format) {
    res.status(400).send("format must be json, html, txt, or md");
    return;
  }
  let document = record.metadata;
  if (document == null) {
    try {
      document = await loadComputedMetadata(
        record.sourceType,
        record.sourceUrl,
        record.sublayer
      );
    } catch (error) {
      console.error(error);
      res.status(502).send("Could not read service metadata");
      return;
    }
  }
  if (document == null) {
    res.status(404).send("Not found");
    return;
  }
  if (format === "json") {
    res.json(document);
    return;
  }
  const body = renderMetadata(document, format);
  if (format === "html") {
    res.type("html").send(body);
    return;
  }
  if (format === "md") {
    res.type("text/markdown; charset=utf-8").send(body);
    return;
  }
  res.type("text/plain; charset=utf-8").send(body);
}

function catalogLayers(
  items: RawTocItem[],
  origin: string,
  slug: string
): CatalogLayer[] {
  return layersInOverlayOrder(items).map((item) => ({
    title: item.title,
    folder: item.folder,
    stableId: item.stableId,
    accessType: item.accessType || "public",
    accessGroupNames: item.accessGroupNames,
    sourceType: item.sourceType,
    sublayerType: item.sublayerType,
    sublayer: item.sublayer,
    sourceUrl: item.sourceUrl,
    sourceLayer: item.sourceLayer,
    createdAt: item.createdAt,
    authorName: item.authorName,
    authorEmail: item.authorEmail,
    geostats: item.geostats,
    attribution: item.attribution,
    enableDownload: item.enableDownload,
    hasMetadata: item.hasMetadata,
    uploadedSourceFilename: item.uploadedSourceFilename,
    outputs: item.outputs,
    styleUrl: layerResourceUrl(origin, slug, item.stableId, "style"),
    geostatsUrl: layerResourceUrl(origin, slug, item.stableId, "geostats"),
    metadataUrl: layerResourceUrl(origin, slug, item.stableId, "metadata"),
  }));
}

async function callerIsAdmin(
  store: LayerCatalogStore,
  projectId: number,
  user: CatalogUser | null
): Promise<boolean> {
  if (!user) {
    return false;
  }
  if (user.superuser) {
    return true;
  }
  return store.isProjectAdmin(projectId, user.id);
}

async function defaultLoadComputedMetadata(
  sourceType: string | null,
  url: string | null,
  sublayer: string | null
): Promise<unknown> {
  const { computedMetadataForArcgis } = await import("./computedMetadata.js");
  return computedMetadataForArcgis(sourceType, url, sublayer);
}

function catalogSlug(req: Request): string | null {
  const slug = req.params.slug;
  if (!slug || slug.includes("/")) {
    return null;
  }
  return slug;
}

export function requestOrigin(req: Request): string {
  const forwardedProto = headerValue(req.headers["x-forwarded-proto"]);
  const forwardedHost = headerValue(req.headers["x-forwarded-host"]);
  const proto = forwardedProto || req.protocol || "https";
  const host = forwardedHost || req.get("host") || "";
  return `${proto}://${host}`;
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value?.split(",")[0]?.trim() || "";
}
