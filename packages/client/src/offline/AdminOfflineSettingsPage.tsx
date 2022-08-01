import React, { Suspense } from "react";
import { useMemo } from "react";
import { Trans as T } from "react-i18next";
import { useParams } from "react-router-dom";
import Spinner from "../components/Spinner";
import Tabs, { TabItem } from "../components/Tabs";

const Trans = (props: any) => <T ns="admin:offline" {...props} />;

const LazyOfflineSurveyMapSettings = React.lazy(
  /* webpackChunkName: "AdminSettings" */ () =>
    import("./OfflineSurveyMapSettings")
);

export default function AdminOfflineSettingsPage() {
  const { slug, subpath } = useParams<{ slug: string; subpath?: string }>();

  const tabs: TabItem[] = useMemo(() => {
    return [
      {
        name: "Surveys",
        href: `/${slug}/admin/offline/surveys`,
        current: subpath === "surveys" || !subpath,
      },
      {
        name: "Maps and Overlays",
        href: `/${slug}/admin/offline/maps`,
        current: subpath === "maps",
        disabled: true,
      },
      {
        name: "Sketching and Reporting",
        href: `/${slug}/admin/offline/sketches`,
        current: subpath === "sketches",
        disabled: true,
      },
    ];
  }, [slug, subpath]);

  return (
    <div>
      <div className="w-full p-5 bg-white shadow">
        <h2 className="text-xl mb-4">
          <Trans>Offline Settings</Trans>
        </h2>
        <div className="flex space-x-5 items-center w-full">
          <Tabs tabs={tabs} />
        </div>
      </div>
      <Suspense fallback={<Spinner />}>
        {(subpath === "surveys" || !subpath) && (
          <LazyOfflineSurveyMapSettings />
        )}
      </Suspense>
    </div>
  );
}
