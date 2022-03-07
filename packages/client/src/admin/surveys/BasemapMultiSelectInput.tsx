import bbox from "@turf/bbox";
import bboxPolygon from "@turf/bbox-polygon";
import { LngLatBoundsLike, Map } from "mapbox-gl";
import { useEffect, useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import Button from "../../components/Button";
import truncate from "@turf/truncate";
import { encode } from "@mapbox/polyline";
import { BBox } from "geojson";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import DrawRectangle from "mapbox-gl-draw-rectangle-mode";
import { useAllBasemapsQuery } from "../../generated/graphql";
import { useParams } from "react-router-dom";
import { PencilIcon, TrashIcon } from "@heroicons/react/outline";
import SelectBasemapsModal from "./SelectBasemapsModal";
import { FormEditorHeader } from "./SurveyFormEditor";
import DropdownButton from "../../components/DropdownButton";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import CreateBasemapModal from "../data/CreateBasemapModal";

export default function BasemapMultiSelectInput({
  value,
  onChange,
}: {
  value?: number[];
  onChange?: (value: number[] | undefined) => void;
}) {
  const { t } = useTranslation("admin:surveys");
  const { slug } = useParams<{ slug: string }>();
  const { data, loading, error, refetch } = useAllBasemapsQuery({});
  const [state, setState] = useState(value || []);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const basemaps = useMemo(() => {
    if (data?.currentProject?.basemaps && data.currentProject.surveyBasemaps) {
      return [
        ...data.currentProject.basemaps,
        ...data.currentProject.surveyBasemaps,
      ];
    }
    return [];
  }, [data]);

  useEffect(() => {
    if (value !== state) {
      setState(value || []);
    }
  }, [value]);

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
              label: t("Select from project maps"),
              onClick: () => setSelectBasemapsModalOpen(true),
            },
            {
              label: t("New basemap"),
              onClick: () => setCreateModalOpen(true),
            },
          ]}
        />
      </FormEditorHeader>
      {createModalOpen && (
        <CreateBasemapModal
          onRequestClose={() => setCreateModalOpen(false)}
          surveysOnly={true}
          onSave={(id) => {
            if (onChange) {
              const newState = [...state, id];
              onChange(newState);
              setState(newState);
              refetch();
            }
          }}
        />
      )}
      <div className="bg-gray-50 bg-opacity-50 border-t -mt-0.5 px-3 py-1 pb-2 border-b">
        {selectBasemapsModalOpen && (
          <SelectBasemapsModal
            value={state}
            onRequestClose={(value) => {
              setSelectBasemapsModalOpen(false);
              if (onChange) {
                onChange(value);
              }
            }}
          />
        )}
        <p className="text-sm text-gray-500 mb-2 mt-1">
          {state.length === 0 && (
            <Trans ns="admin:surveys">
              If no basemaps are specified, your project's already configured
              maps will be used
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
                state,
                result.source.index,
                result.destination.index
              );

              if (onChange) {
                setState(sorted);
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
                    {state.map((id, i) => {
                      const basemap = basemaps.find((b) => b.id === id);
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
                                className="flex bg-white p-2 border rounded shadow-sm select-none overflow-hidden"
                              >
                                <div
                                  {...provided.dragHandleProps}
                                  className="flex items-center flex-1"
                                >
                                  <img
                                    src={basemap.thumbnail}
                                    className="w-8 h-8 rounded shadow select-none"
                                  />
                                  <div className="flex-1 truncate select-none ml-1">
                                    {basemap.name}
                                  </div>
                                </div>
                                <div className="flex space-x-2 items-center">
                                  <button>
                                    <PencilIcon className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      const newState = state.filter(
                                        (i) => i !== basemap.id
                                      );
                                      setState(newState);
                                      if (onChange) {
                                        onChange(newState);
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
          {state.length > 1 ? (
            <p className="py-2 text-gray-500 italic text-sm text-center">
              <Trans ns="admin:surveys">
                First listed will be the default.
              </Trans>
              <br />
              <Trans ns="admin:surveys">Drag and drop to sort.</Trans>
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
