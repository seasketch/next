import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdminOverlayFragment,
  DataLayerDetailsFragment,
  useQuotaUsageDetailsQuery,
} from "../../generated/graphql";
import { Trans } from "react-i18next";
import bytes from "bytes";
import Warning from "../../components/Warning";
import Spinner from "../../components/Spinner";
import QuotaUsageTreemap from "./QuotaUsageTreemap";
import {
  EnterFullScreenIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import QuotaUsageModal from "./QuotaUsageModal";

const WIDTH = 488;

export default function QuotaUsageDetails({
  slug,
  tableOfContentsItems,
  layers,
}: {
  slug: string;
  tableOfContentsItems: AdminOverlayFragment[];
  layers: DataLayerDetailsFragment[];
}) {
  const treeMapContainer = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [showFullscreen, setShowFullscreen] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      if (treeMapContainer.current) {
        setContainerHeight(treeMapContainer.current.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  });

  const { data, loading, error } = useQuotaUsageDetailsQuery({
    variables: {
      slug,
    },
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (treeMapContainer.current) {
      setContainerHeight(treeMapContainer.current.clientHeight);
    }
  }, [treeMapContainer, tableOfContentsItems, data]);

  const totalQuotaUsage = useMemo(() => {
    const total = data?.projectBySlug?.dataHostingQuota
      ? parseInt(data.projectBySlug.dataHostingQuota)
      : 0;
    const used = data?.projectBySlug?.dataHostingQuotaUsed
      ? parseInt(data.projectBySlug.dataHostingQuotaUsed)
      : 0;
    return {
      total,
      used,
      fraction: used / total,
    };
  }, [data?.projectBySlug]);

  if (error) {
    return (
      <Warning level="error">
        {error.message || "An error occurred while loading usage info."}
      </Warning>
    );
  }
  return (
    <div className="flex flex-col h-full">
      <div className="flex-none">
        <div className="space-y-2 pt-2">
          <h3>
            <Trans ns="admin:data">Data Hosting Quota Usage</Trans>
          </h3>
          <div className="text-sm">
            {loading && !data ? (
              <>
                <Trans ns="admin:data">Loading usage info...</Trans>
                <Spinner mini className="ml-1" />
              </>
            ) : (
              <>
                {bytes(totalQuotaUsage.used)} / {bytes(totalQuotaUsage.total)}{" "}
                {totalQuotaUsage.fraction >= 1 ? (
                  <span className="text-red-600">
                    <ExclamationTriangleIcon className="inline mx-1 " />
                    <Trans ns="admin:data">Over quota</Trans>
                  </span>
                ) : (
                  ""
                )}
              </>
            )}
            <div className="w-full rounded h-5 bg-gray-100 overflow-hidden border shadow-sm">
              <div
                className={`h-full transition-all duration-500 ${
                  totalQuotaUsage.fraction >= 1
                    ? "bg-red-500"
                    : totalQuotaUsage.fraction >= 0.8
                    ? "bg-yellow-500"
                    : "bg-primary-500"
                }`}
                style={{ width: `${totalQuotaUsage.fraction * 100}%` }}
              ></div>
            </div>
          </div>
          <p className="text-gray-500 text-sm">
            <Trans ns="admin:data">
              Each SeaSketch project supports free hosting of data uploads up to
              the storage limit specified above. Use the visualization below to
              manage your data usage and see how uploaded files and generated
              map tiles contribute to this limit.{" "}
              <a
                className="text-primary-500 underline"
                href="mailto:support@seasketch.org"
                target="_blank"
              >
                Contact support
              </a>{" "}
              if you need more space or delete layers to free up quota.
            </Trans>
          </p>
          {data && (
            <h4 className="flex space-x-2 pt-2">
              <span className="flex-1">
                <Trans ns="admin:data">Usage by Source</Trans>
              </span>
              {(data.projectBySlug?.dataHostingQuotaUsed || 0) > 0 && (
                <button
                  className="z-10 text-xs flex items-center bg-gray-100 rounded-full px-2 space-x-1 border"
                  onClick={() => setShowFullscreen(true)}
                >
                  <span className="">
                    <Trans ns="admin:data">view larger</Trans>
                  </span>
                  <EnterFullScreenIcon className="inline" />
                </button>
              )}
            </h4>
          )}
        </div>
        {showFullscreen && (
          <QuotaUsageModal
            {...{
              slug,
              tableOfContentsItems,
              layers,
              onRequestClose: () => setShowFullscreen(false),
            }}
          />
        )}
      </div>
      <div id="icx" className="flex-1" ref={treeMapContainer}>
        {/* eslint-disable-next-line i18next/no-literal-string */}
        {totalQuotaUsage.used > 0 ? (
          <QuotaUsageTreemap
            width={WIDTH}
            height={containerHeight - 14}
            layers={layers}
            slug={slug}
            tableOfContentsItems={tableOfContentsItems}
          />
        ) : loading ? null : (
          <Warning level="info">
            <Trans ns="admin:data">
              This project does not yet have any data sources which contribute
              to the storage limit.
            </Trans>
          </Warning>
        )}
      </div>
    </div>
  );
}
