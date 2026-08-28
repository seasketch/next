import { Trans, useTranslation } from "react-i18next";

export function localizedCkanDatasetUrl(url: string, lang?: string) {
  if (!url || !lang) {
    return url;
  }
  const requested = lang.toLowerCase();
  return url.replace(
    /\/([a-z]{2}(?:-[a-z]{2,8})?)(?=\/dataset\/|\/package\/)/i,
    `/${requested}`
  );
}

export default function CkanSourceFooter({
  url,
  siteTitle,
  className,
}: {
  url: string;
  siteTitle?: string | null;
  className?: string;
}) {
  const { t } = useTranslation("homepage");
  return (
    <div
      className={`text-sm bg-gray-50 p-2 border border-gray-300 rounded ${
        className ?? "mt-5"
      }`}
    >
      <div className="font-medium text-gray-800">
        {siteTitle
          ? t("Metadata retrieved from {{siteTitle}}", { siteTitle })
          : t("Original metadata record")}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline break-all"
      >
        <Trans ns="homepage">View original record</Trans>
      </a>
    </div>
  );
}
