import { CameraOptions } from "mapbox-gl";
import { useEffect, useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useAllBasemapsQuery } from "../../generated/graphql";
import { Link, useParams } from "react-router-dom";
import { TrashIcon } from "@heroicons/react/outline";
import SelectBasemapsModal from "./SelectBasemapsModal";
import { FormEditorHeader } from "./SurveyFormEditor";
import DropdownButton from "../../components/DropdownButton";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import CreateBasemapModal from "../data/CreateBasemapModal";

function filterBasemaps<T extends { id: number }>(
  basemaps: T[],
  ids: number[] | undefined | null
): T[] {
  const idList = ids || [];
  return idList
    .map((id) => basemaps.find((b) => b.id === id))
    .filter(Boolean) as T[];
}

export default function BasemapMultiSelectInput({
  value,
  onChange,
  disabledMessage,
  cameraOptions,
}: {
  value?: number[];
  onChange?: (value: number[] | undefined) => void;
  disabledMessage?: string;
  cameraOptions?: CameraOptions;
  /** Used if user clicks through to the basemap editor page */
  returnToUrl?: string;
}) {
  const { t } = useTranslation("admin:surveys");
  const { slug } = useParams<{ slug: string }>();
  const { data, refetch } = useAllBasemapsQuery({
    variables: {
      slug,
    },
  });
  const [state, setState] = useState(value || []);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const basemaps = useMemo(() => {
    if (data?.projectBySlug?.basemaps && data.projectBySlug?.surveyBasemaps) {
      return [
        ...data.projectBySlug?.basemaps,
        ...data.projectBySlug?.surveyBasemaps,
      ];
    }
    return [];
  }, [data]);

  useEffect(() => {
    const newValue = filterBasemaps(basemaps || [], value).map((b) => b.id);
    if (newValue.join(",") !== state.join(",")) {
      setState(newValue);
    }
  }, [value, basemaps, state]);

  const [selectBasemapsModalOpen, setSelectBasemapsModalOpen] = useState(false);

  return (
    <>
      <FormEditorHeader className="mt-4 relative flex">
        <span className="flex-1">{t("Basemaps")}</span>

        <DropdownButton
          small
          disabled={!!disabledMessage}
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
      {disabledMessage ? (
        <p className="p-2 text-sm text-gray-500">{disabledMessage}</p>
      ) : (
        <>
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
          <div className="bg-gray-50 bg-opacity-50 border-t -mt-0.5 px-3 py-1 pb-10 border-b">
            {selectBasemapsModalOpen && (
              <SelectBasemapsModal
                value={state}
                onRequestClose={(value) => {
                  setSelectBasemapsModalOpen(false);
                  setState(value);
                  if (onChange) {
                    onChange(value);
                  }
                }}
              />
            )}
            <p className="text-sm text-gray-500 mb-2 mt-1">
              {state.length === 0 && (
                <Trans ns="admin:surveys">
                  If no basemaps are specified, your project's already
                  configured maps will be used
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
                                      className="flex items-center flex-1 overflow-hidden space-x-2"
                                    >
                                      <img
                                        alt="basemap preview"
                                        src={basemap.thumbnail}
                                        className="w-8 h-8 rounded shadow select-none"
                                      />
                                      <div className="flex-1 truncate select-none">
                                        {basemap.name}
                                      </div>
                                    </div>
                                    <div className="flex space-x-2 items-center underline px-1 text-sm">
                                      <Link
                                        to={`/${slug}/edit-basemap/${
                                          basemap.id
                                        }?returnToUrl=${
                                          window.location.pathname
                                        }&camera=${btoa(
                                          JSON.stringify(cameraOptions)
                                        )}`}
                                      >
                                        <Trans ns="admin:surveys">edit</Trans>
                                      </Link>
                                      <button
                                        onClick={() => {
                                          if (
                                            window.confirm(
                                              t(
                                                "Are you sure you want to remove this map?"
                                              )
                                            )
                                          ) {
                                            const newState = state.filter(
                                              (i) => i !== basemap.id
                                            );
                                            setState(newState);
                                            if (onChange) {
                                              onChange(newState);
                                            }
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
      )}
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
