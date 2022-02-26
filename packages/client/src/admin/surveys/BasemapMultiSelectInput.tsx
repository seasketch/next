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
import { PencilIcon, TrashIcon } from "@heroicons/react/outline";
import SelectBasemapsModal from "./SelectBasemapsModal";
import { FormEditorHeader } from "./SurveyFormEditor";
import DropdownButton from "../../components/DropdownButton";
import {
  DragDropContext,
  Draggable,
  DraggableProvided,
  DraggableStateSnapshot,
  Droppable,
} from "react-beautiful-dnd";

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

  const [selectBasemapsModalOpen, setSelectBasemapsModalOpen] = useState(false);

  return (
    <>
      <FormEditorHeader className="mt-4 relative flex">
        <span className="flex-1">{t("Basemaps")}</span>
        <DropdownButton
          small
          label={t("add")}
          options={[
            {
              label: t("Existing basemap"),
              onClick: () => setSelectBasemapsModalOpen(true),
            },
            {
              label: t("New basemap"),
              onClick: () => null,
              disabled: true,
            },
          ]}
        />
      </FormEditorHeader>
      <div className="bg-gray-50 border-t -mt-0.5 px-3 py-1 pb-8">
        {selectBasemapsModalOpen && (
          <SelectBasemapsModal
            value={value || []}
            onRequestClose={(value) => {
              setSelectBasemapsModalOpen(false);
              if (onChange) {
                onChange(value);
              }
            }}
          />
        )}
        <p className="text-sm text-gray-500 mb-2 mt-1">
          {(!value || value.length === 0) && (
            <Trans ns="admin:surveys">
              If no basemaps are specified, a default will be chosen from your
              project
            </Trans>
          )}
        </p>
        <div className="relative space-y-1 py-2">
          <DragDropContext
            onDragEnd={(result) => {
              if (!result.destination) {
                return;
              }
              let sorted = reorder(
                value || [],
                result.source.index,
                result.destination.index
              );
              if (onChange) {
                onChange(sorted);
              }
            }}
          >
            <Droppable droppableId="droppable">
              {(provided, snapshot) => {
                return (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2"
                  >
                    {(value || []).map((id, i) => {
                      const basemap = (
                        data?.projectBySlug?.basemaps || []
                      ).find((b) => b.id === id);
                      if (basemap) {
                        return (
                          <Draggable
                            index={i}
                            draggableId={basemap.id.toString()}
                            key={basemap.id}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided?.innerRef}
                                {...provided?.draggableProps}
                                style={provided?.draggableProps.style}
                                key={basemap.id}
                                className="flex items-center space-x-2 bg-white p-2 border rounded shadow-sm select-none"
                              >
                                <div
                                  {...provided.dragHandleProps}
                                  className="flex items-center space-x-2 flex-1"
                                >
                                  <img
                                    src={basemap.thumbnail}
                                    className="w-8 h-8 rounded shadow select-none"
                                  />
                                  <div className="flex-1 truncate select-none">
                                    {basemap.name}
                                  </div>
                                </div>
                                <div className="flex space-x-2 items-center">
                                  <button>
                                    <PencilIcon className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (onChange) {
                                        onChange(
                                          (value || []).filter(
                                            (i) => i !== basemap.id
                                          )
                                        );
                                      }
                                    }}
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      } else {
                        return null;
                      }
                    })}
                    {provided.placeholder}
                  </div>
                );
              }}
            </Droppable>
          </DragDropContext>
          {value?.length && value?.length > 1 ? (
            <p className="py-2 text-gray-500 italic text-sm text-center">
              <Trans ns="admin:surveys">First listed will be the default</Trans>
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}

/**
 * Reorders the given list, moving an item from startIndex to endIndex
 * @param list
 * @param startIndex
 * @param endIndex
 * @returns
 */
function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}
