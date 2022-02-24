import bbox from "@turf/bbox";
import bboxPolygon from "@turf/bbox-polygon";
import { LngLatBoundsLike, Map } from "mapbox-gl";
import { useEffect, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import Button from "../../components/Button";
import truncate from "@turf/truncate";
import { encode } from "@mapbox/polyline";
import { BBox } from "geojson";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import DrawRectangle from "mapbox-gl-draw-rectangle-mode";
import { useGetBasemapsQuery } from "../../generated/graphql";
import { useParams } from "react-router-dom";
import Switch from "../../components/Switch";

export default function BasemapMultiSelectInput({
  value,
  onChange,
}: {
  value?: number[];
  onChange?: (value: number[] | undefined) => void;
}) {
  const { t } = useTranslation("admin:surveys");
  const { slug } = useParams<{ slug: string }>();
  const { data, loading, error } = useGetBasemapsQuery({
    variables: {
      slug,
    },
  });

  const updateSelection = (id: number, toggled: boolean) => {
    if (onChange && data?.projectBySlug?.basemaps?.length) {
      value = value || [];
      onChange(
        data.projectBySlug.basemaps
          .map((b) => b.id)
          .filter((b) => {
            if (b === id) {
              return toggled;
            } else {
              return (value || []).indexOf(b) !== -1;
            }
          })
      );
    }
  };

  return (
    <div>
      <h4 className="block text-sm font-medium leading-5 text-gray-800">
        {t("Basemaps")}
      </h4>
      <p className="text-sm text-gray-500 mb-2 mt-1">
        <Trans ns="admin:surveys">
          Choose which basemaps from your project to include as options.&nbsp;
        </Trans>
      </p>
      <div className="relative space-y-1 py-2">
        {(data?.projectBySlug?.basemaps || []).map((basemap, i) => (
          <div key={basemap.id} className="flex items-center space-x-2">
            <img src={basemap.thumbnail} className="w-8 h-8 rounded shadow" />
            <div className="flex-1">{basemap.name}</div>
            <Switch
              className=""
              isToggled={
                (!value && i === 0) || (value || []).indexOf(basemap.id) !== -1
              }
              onClick={(toggled) => updateSelection(basemap.id, toggled)}
            />
          </div>
        ))}
        <p className="h-6 py-2 text-gray-500 italic text-xs">
          {value?.length === 0 && (
            <Trans ns="admin:surveys">
              If none are selected, the first basemap in the list will be used.
            </Trans>
          )}
        </p>
      </div>
    </div>
  );
}
