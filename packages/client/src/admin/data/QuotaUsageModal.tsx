/* eslint-disable i18next/no-literal-string */
import { Trans } from "react-i18next";
import Modal from "../../components/Modal";
import {
  AdminOverlayFragment,
  DataLayerDetailsFragment,
} from "../../generated/graphql";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import QuotaUsageTreemap from "./QuotaUsageTreemap";
import { XCircleIcon } from "@heroicons/react/solid";

export default function QuotaUsageModal({
  onRequestClose,
  slug,
  tableOfContentsItems,
  layers,
}: {
  onRequestClose: () => void;
  slug: string;
  tableOfContentsItems: AdminOverlayFragment[];
  layers: DataLayerDetailsFragment[];
}) {
  const treeMapContainer = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const handleResize = () => {
      if (treeMapContainer.current) {
        setContainerDimensions({
          width: treeMapContainer.current.clientWidth,
          height: treeMapContainer.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [treeMapContainer]);

  useEffect(() => {
    if (treeMapContainer.current) {
      setContainerDimensions({
        width: treeMapContainer.current.clientWidth,
        height: treeMapContainer.current.clientHeight,
      });
    }
  }, [tableOfContentsItems, layers]);

  return createPortal(
    <div
      className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-30 flex items-center"
      style={{ backdropFilter: "blur(4px)", opacity: 1 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onRequestClose();
        }
      }}
    >
      <div className="w-3/4 h-3/4 bg-white rounded mx-auto my-auto p-4 flex flex-col">
        <div className="flex items-center">
          <h3 className="flex-1">
            <Trans ns="admin:data">Data Quota Usage by Source</Trans>
          </h3>
          <button
            onClick={onRequestClose}
            className="text-gray-600 hover:text-black w-8 h-8 -mr-3 -mt-3"
          >
            <XCircleIcon className="w-5 h-5 " />
          </button>
        </div>
        <div ref={treeMapContainer} className="w-full h-full">
          <QuotaUsageTreemap
            slug={slug}
            tableOfContentsItems={tableOfContentsItems}
            layers={layers}
            width={containerDimensions.width}
            height={containerDimensions.height}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
