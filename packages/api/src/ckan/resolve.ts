import {
  ckanFieldsToProseMirror,
  discoverCkanFields,
  isCkanDisplayConfig,
  localizedDatasetPageUrl,
  normalizeCkanPackage,
  packageTitle,
  parseCkanUrl,
  resolveFluent,
} from "ckan-metadata";
import { fetchCkanAction } from "./fetcher";

export async function loadCkanPackageAndSchema(datasetUrl: string) {
  const parsed = parseCkanUrl(datasetUrl);
  if (!parsed) {
    throw new Error("Not a recognized CKAN dataset URL");
  }
  const pkg = await fetchCkanAction(parsed.apiRoot, "package_show", {
    id: parsed.datasetId,
  });
  if (!pkg || typeof pkg !== "object") {
    throw new Error("CKAN dataset could not be loaded");
  }
  const datasetType =
    typeof (pkg as { type?: unknown }).type === "string"
      ? ((pkg as { type: string }).type as string)
      : "dataset";
  let schema: unknown = null;
  try {
    schema = await fetchCkanAction(parsed.apiRoot, "scheming_dataset_schema_show", {
      type: datasetType,
    });
  } catch {
    schema = null;
  }
  let siteTitle: string | undefined;
  try {
    const status = await fetchCkanAction(parsed.apiRoot, "status_show", {});
    if (
      status &&
      typeof status === "object" &&
      typeof (status as { site_title?: unknown }).site_title === "string"
    ) {
      siteTitle = (status as { site_title: string }).site_title;
    }
  } catch {
    siteTitle = undefined;
  }
  return { parsed, pkg, schema, siteTitle };
}

export function availableLanguages(pkg: unknown, schema: unknown): string[] {
  const keys = new Set<string>();
  if (schema && typeof schema === "object") {
    const form = (schema as { form_languages?: unknown }).form_languages;
    if (Array.isArray(form)) {
      for (const item of form) {
        if (typeof item === "string") {
          keys.add(item);
        }
      }
    }
  }
  if (pkg && typeof pkg === "object") {
    const translated = (pkg as { title_translated?: unknown }).title_translated;
    if (translated && typeof translated === "object") {
      for (const key of Object.keys(translated as object)) {
        keys.add(key);
      }
    }
    const notes = (pkg as { notes_translated?: unknown }).notes_translated;
    if (notes && typeof notes === "object") {
      for (const key of Object.keys(notes as object)) {
        keys.add(key);
      }
    }
  }
  return Array.from(keys);
}

export function buildCkanDocument(
  pkg: unknown,
  schema: unknown,
  config: unknown,
  lang?: string | null
) {
  const displayConfig = isCkanDisplayConfig(config) ? config : undefined;
  const fields = normalizeCkanPackage(pkg, schema, { lang: lang ?? undefined });
  return ckanFieldsToProseMirror(fields, displayConfig, {
    title: packageTitle(pkg as Record<string, unknown>, lang ?? undefined),
    lang: lang ?? undefined,
    resources: (pkg as { resources?: unknown })?.resources,
  });
}

export function localizedSourceUrl(
  datasetUrl: string,
  lang?: string | null
): string {
  const parsed = parseCkanUrl(datasetUrl);
  if (!parsed) {
    return datasetUrl;
  }
  return localizedDatasetPageUrl(parsed, lang);
}

/** Admin preview payload: localized title, field universe, and generated document. */
export function previewPayload(
  datasetUrl: string,
  pkg: unknown,
  schema: unknown,
  siteTitle: string | undefined,
  config: unknown,
  lang?: string | null
) {
  const parsed = parseCkanUrl(datasetUrl);
  if (!parsed) {
    throw new Error("Not a recognized CKAN dataset URL");
  }
  const displayConfig = isCkanDisplayConfig(config) ? config : undefined;
  const fields = discoverCkanFields(schema, pkg, { lang: lang ?? undefined });
  const document = buildCkanDocument(pkg, schema, displayConfig, lang);
  const title = packageTitle(pkg as Record<string, unknown>, lang ?? undefined);
  const notes = resolveFluent(
    (pkg as { notes_translated?: unknown })?.notes_translated ??
      (pkg as { notes?: unknown })?.notes,
    lang,
    schema as never
  );
  return {
    baseUrl: parsed.baseUrl,
    datasetId: parsed.datasetId,
    datasetPageUrl: localizedDatasetPageUrl(parsed, lang),
    siteTitle: siteTitle ?? null,
    datasetTitle: title ?? null,
    description:
      typeof notes === "string" ? notes.slice(0, 280) : null,
    availableLanguages: availableLanguages(pkg, schema),
    schemaAvailable: Boolean(schema),
    fields,
    document,
  };
}
