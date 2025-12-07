import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

interface INaturalistProject {
  id: number;
  title: string;
  description?: string | null;
  slug?: string | null;
  header_image_url?: string | null;
  icon?: string | null;
  observations_count?: number;
}

export default function INaturalistProjectCallToAction({
  projectId,
  onHide,
}: {
  projectId: string;
  onHide?: (projectId: string) => void;
}) {
  const { t } = useTranslation("admin:data");
  const [project, setProject] = useState<INaturalistProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!projectId) {
      return;
    }
    let cancelled = false;
    setLoading(true);

    async function fetchProject() {
      try {
        // eslint-disable-next-line i18next/no-literal-string
        const url = `https://api.inaturalist.org/v1/projects/${encodeURIComponent(
          projectId
        )}`;
        const resp = await fetch(url);
        if (!resp.ok) {
          return;
        }
        const json = (await resp.json()) as {
          results?: INaturalistProject[];
        };
        if (!cancelled && json.results && json.results[0]) {
          setProject(json.results[0]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchProject();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!projectId) {
    return null;
  }

  if (hidden) {
    if (onHide) {
      onHide(projectId);
    }
    return null;
  }

  const title = project?.title || t("iNaturalist Project");
  const descriptionRaw =
    (project?.description && project.description.replace(/\s+/g, " ").trim()) ||
    "";
  const maxDescriptionLength = 120;
  const description =
    descriptionRaw.length > maxDescriptionLength
      ? // eslint-disable-next-line i18next/no-literal-string
        `${descriptionRaw.slice(0, maxDescriptionLength)}…`
      : descriptionRaw;

  const observationCount =
    typeof project?.observations_count === "number"
      ? project.observations_count
      : null;

  const projectUrl = project?.slug
    ? // eslint-disable-next-line i18next/no-literal-string
      `https://www.inaturalist.org/projects/${project.slug}`
    : project?.id
    ? // eslint-disable-next-line i18next/no-literal-string
      `https://www.inaturalist.org/projects/${project.id}`
    : null;

  const backgroundImage =
    project?.header_image_url || project?.icon || undefined;

  return (
    <div
      className="w-[400px] h-20 rounded shadow-lg overflow-hidden bg-gray-900/80 text-white flex items-stretch"
      style={
        backgroundImage
          ? {
              backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.7), rgba(0,0,0,0.3)), url(${backgroundImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : {}
      }
    >
      <div className="flex-1 px-4 py-2 flex flex-col justify-center">
        <div className="flex items-start justify-between space-x-2">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-gray-300 mb-0.5">
              <Trans ns="admin:data">iNaturalist Project Layer</Trans>
            </div>
            <div className="font-semibold text-sm leading-snug line-clamp-2">
              {projectUrl ? (
                <a
                  href={projectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {title}
                </a>
              ) : (
                title
              )}
            </div>
          </div>
          {observationCount !== null && (
            <div className="text-xs bg-black/40 rounded px-2 py-0.5 whitespace-nowrap ml-2 self-center">
              <Trans
                ns="admin:data"
                i18nKey="{{count}} observations"
                values={{ count: observationCount }}
              >
                {{ count: observationCount }} observations
              </Trans>
            </div>
          )}
        </div>
        {description && (
          <div className="text-[11px] mt-1 line-clamp-2">{description}</div>
        )}
      </div>
      {projectUrl && (
        <div className="flex-none flex flex-col items-center justify-center pr-3 space-y-1">
          <a
            href={projectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-white hover:underline bg-[#74ac00]/80 px-2 py-1 rounded"
          >
            <Trans ns="admin:data">Add Observations</Trans>
          </a>
          <button
            type="button"
            className="text-xs text-gray-300 hover:text-white hover:underline"
            onClick={() => setHidden(true)}
          >
            <Trans ns="admin:data">Hide Banner</Trans>
          </button>
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 bg-black/10 flex items-center justify-center text-[10px]">
          {t("Loading…")}
        </div>
      )}
    </div>
  );
}
