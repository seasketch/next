import { Trans } from "react-i18next";

export default function EsriRestUrlFooter({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  return (
    <div
      className={`text-sm bg-gray-50 p-2 border border-gray-300 rounded ${
        className ?? "mt-5"
      }`}
    >
      <div className="font-medium text-gray-800">
        <Trans ns="homepage">ESRI REST URL</Trans>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline break-all"
      >
        {url}
      </a>
    </div>
  );
}
