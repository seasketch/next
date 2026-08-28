import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import AdminDataViewScreenHeading from "./AdminDataViewScreenHeading";
import MetadataDocumentView from "../../dataLayers/MetadataDocumentView";
import Spinner from "../../components/Spinner";
import Button from "../../components/Button";
import {
  useCkanDatasetPreviewLazyQuery,
  useProjectCkanMetadataSourcesQuery,
  useUpdateCkanMetadataSourceMutation,
} from "../../generated/graphql";
import useCurrentLang from "../../useCurrentLang";
import languages from "../../lang/supported";

type FieldUniverseItem = {
  id: string;
  label: string;
  group?: string;
  recommended?: boolean;
  technical?: boolean;
};

type DisplayField = {
  id: string;
  included: boolean;
  label?: string;
};

type DisplayConfig = {
  fields?: DisplayField[];
  includeResources?: boolean;
};

function groupName(
  group: string | undefined,
  t: (key: string) => string
) {
  switch (group) {
    case "Overview":
      return t("Overview");
    case "Dates":
      return t("Dates");
    case "Attribution":
      return t("Attribution");
    case "Resources":
      return t("Resources");
    default:
      return t("Other");
  }
}

export default function CkanMetadataSourcesPanel({
  slug,
}: {
  slug: string;
}) {
  const { t } = useTranslation("admin:data");
  const currentLang = useCurrentLang();
  const { data, loading, error } = useProjectCkanMetadataSourcesQuery({
    variables: { slug },
  });
  const sources = data?.projectBySlug?.ckanMetadataSources || [];
  const layers = (data?.projectBySlug?.draftTableOfContentsItems || []).filter(
    (item) => item.ckanDatasetUrl
  );
  const [selectedSourceId, setSelectedSourceId] = useState<number>();
  const selected =
    sources.find((source) => source.id === selectedSourceId) || sources[0];

  const sampleLayers = useMemo(() => {
    if (!selected) {
      return [];
    }
    return layers.filter((layer) =>
      (layer.ckanDatasetUrl || "").startsWith(selected.baseUrl)
    );
  }, [layers, selected]);

  const [sampleUrl, setSampleUrl] = useState<string>();
  const effectiveSample = sampleUrl || sampleLayers[0]?.ckanDatasetUrl || "";
  const supported = data?.projectBySlug?.supportedLanguages || [];
  const previewLangs = languages.filter(
    (lang) =>
      lang.code === "EN" ||
      supported.includes(lang.code) ||
      lang.code === currentLang.code
  );
  const [previewLang, setPreviewLang] = useState(currentLang.code);
  const [draftConfig, setDraftConfig] = useState<DisplayConfig>();
  const config = draftConfig || (selected?.displayConfig as DisplayConfig) || {};

  const [loadPreview, previewState] = useCkanDatasetPreviewLazyQuery();
  const [saveConfig, saveState] = useUpdateCkanMetadataSourceMutation();

  const fields = useMemo(
    () =>
      (previewState.data?.ckanDatasetPreview?.fields ||
        []) as FieldUniverseItem[],
    [previewState.data?.ckanDatasetPreview?.fields]
  );

  const load = async (url: string, nextConfig?: DisplayConfig, lang?: string) => {
    if (!url) {
      return;
    }
    await loadPreview({
      variables: {
        url,
        config: nextConfig || config,
        lang: lang || previewLang,
      },
    });
  };

  useEffect(() => {
    if (effectiveSample) {
      void loadPreview({
        variables: {
          url: effectiveSample,
          config,
          lang: previewLang,
        },
      });
    }
    // Load when the selected source, sample record, or preview language changes.
    // Intentionally omit `config` so checkbox edits do not double-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSample, previewLang, selected?.id]);

  const includedIds = new Set(
    (config.fields || [])
      .filter((field) => field.included)
      .map((field) => field.id)
  );
  const usingExplicitFields = Boolean(config.fields && config.fields.length);

  const toggleField = (id: string, included: boolean) => {
    const universe: FieldUniverseItem[] = fields.length
      ? fields
      : (config.fields || []).map((field) => ({
          id: field.id,
          label: field.label || field.id,
          recommended: field.included,
        }));
    const nextFields: DisplayField[] = universe.map((field) => {
      const existing = config.fields?.find((item) => item.id === field.id);
      const currentlyIncluded = usingExplicitFields
        ? Boolean(existing?.included)
        : Boolean(field.recommended);
      return {
        id: field.id,
        included: field.id === id ? included : currentlyIncluded,
        label: existing?.label,
      };
    });
    const next = { ...config, fields: nextFields };
    setDraftConfig(next);
    if (effectiveSample) {
      load(effectiveSample, next, previewLang);
    }
  };

  const moveField = (id: string, direction: -1 | 1) => {
    const current = [...(config.fields || fields.map((field) => ({
      id: field.id,
      included: Boolean(field.recommended),
    })))];
    const index = current.findIndex((field) => field.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
      return;
    }
    const [item] = current.splice(index, 1);
    current.splice(nextIndex, 0, item);
    const next = { ...config, fields: current };
    setDraftConfig(next);
    if (effectiveSample) {
      load(effectiveSample, next, previewLang);
    }
  };

  const setLabel = (id: string, label: string) => {
    const current = [...(config.fields || [])];
    const index = current.findIndex((field) => field.id === id);
    if (index === -1) {
      current.push({ id, included: includedIds.has(id), label });
    } else {
      current[index] = { ...current[index], label };
    }
    setDraftConfig({ ...config, fields: current });
  };

  const groups = useMemo(() => {
    const map = new Map<string, FieldUniverseItem[]>();
    for (const field of fields.filter((item) => !item.technical)) {
      const key = groupName(field.group, t);
      const list = map.get(key) || [];
      list.push(field);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [fields, t]);

  if (loading) {
    return (
      <div className="p-4">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <AdminDataViewScreenHeading>
        <Trans ns="admin:data">CKAN metadata sources</Trans>
      </AdminDataViewScreenHeading>
      <p className="mt-2 max-w-3xl text-sm text-gray-600">
        <Trans ns="admin:data">
          Field selection is shared by every layer linked to a catalogue.
          Changes here update all of those layers immediately.
        </Trans>
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error.message}</p>}
      {sources.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          <Trans ns="admin:data">
            No CKAN sources yet. Paste a dataset URL on a layer metadata tab to
            add one.
          </Trans>
        </p>
      ) : (
        <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="min-h-0 overflow-y-auto space-y-4">
            <ul className="space-y-2">
              {sources.map((source) => {
                const count = layers.filter((layer) =>
                  (layer.ckanDatasetUrl || "").startsWith(source.baseUrl)
                ).length;
                const active = source.id === selected?.id;
                return (
                  <li key={source.id}>
                    <button
                      type="button"
                      className={`w-full rounded border px-3 py-2 text-left text-sm ${
                        active
                          ? "border-primary-500 bg-primary-50"
                          : "border-gray-200 bg-white"
                      }`}
                      onClick={() => {
                        setSelectedSourceId(source.id);
                        setDraftConfig(undefined);
                        setSampleUrl(undefined);
                      }}
                    >
                      <div className="font-medium text-gray-900">
                        {source.title || source.baseUrl}
                      </div>
                      <div className="text-xs text-gray-500 break-all">
                        {source.baseUrl}
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        {t("{{count}} linked layers", { count })}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            {selected && (
              <div className="space-y-3 rounded border border-gray-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-gray-600">
                    {t("Sample record")}
                    <select
                      className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm"
                      value={effectiveSample}
                      onChange={(event) => {
                        setSampleUrl(event.target.value);
                        load(event.target.value, config, previewLang);
                      }}
                    >
                      {sampleLayers.map((layer) => (
                        <option key={layer.id} value={layer.ckanDatasetUrl || ""}>
                          {layer.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-gray-600">
                    {t("Preview language")}
                    <select
                      className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm"
                      value={previewLang}
                      onChange={(event) => {
                        setPreviewLang(event.target.value);
                        if (effectiveSample) {
                          load(effectiveSample, config, event.target.value);
                        }
                      }}
                    >
                      {previewLangs.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    small
                    onClick={() => effectiveSample && load(effectiveSample)}
                    loading={previewState.loading}
                    label={t("Load fields")}
                  />
                </div>
                {groups.map(([group, items]) => (
                  <div key={group}>
                    <h3 className="text-xs font-semibold uppercase text-gray-500">
                      {group}
                    </h3>
                    <ul className="mt-1 space-y-1">
                      {items.map((field) => {
                        const included = usingExplicitFields
                          ? includedIds.has(field.id)
                          : Boolean(field.recommended);
                        const override = config.fields?.find(
                          (item) => item.id === field.id
                        )?.label;
                        return (
                          <li
                            key={field.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={included}
                              onChange={(event) =>
                                toggleField(field.id, event.target.checked)
                              }
                            />
                            <input
                              className="min-w-0 flex-1 rounded border border-gray-200 px-1 py-0.5"
                              value={override ?? field.label}
                              onChange={(event) =>
                                setLabel(field.id, event.target.value)
                              }
                            />
                            <button
                              type="button"
                              className="text-xs text-gray-500"
                              onClick={() => moveField(field.id, -1)}
                            >
                              {t("Up")}
                            </button>
                            <button
                              type="button"
                              className="text-xs text-gray-500"
                              onClick={() => moveField(field.id, 1)}
                            >
                              {t("Down")}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                <Button
                  primary
                  small
                  disabled={!selected}
                  loading={saveState.loading}
                  label={t("Save source defaults")}
                  onClick={() => {
                    if (!selected) {
                      return;
                    }
                    saveConfig({
                      variables: {
                        id: selected.id,
                        displayConfig: config,
                      },
                    });
                  }}
                />
              </div>
            )}
          </div>
          <div className="min-h-0 overflow-y-auto rounded border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-800">
              <Trans ns="admin:data">Preview</Trans>
            </h3>
            {previewState.loading && <Spinner />}
            {previewState.error && (
              <p className="text-sm text-red-600">{previewState.error.message}</p>
            )}
            {previewState.data?.ckanDatasetPreview?.document && (
              <MetadataDocumentView
                document={previewState.data.ckanDatasetPreview.document}
                className="ProseMirror metadata small-variant"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
