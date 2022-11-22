import {
  SketchingDetailsFragment,
  SketchingDocument,
  SketchingQuery,
  SketchTocDetailsFragment,
  useCreateSketchMutation,
} from "../../generated/graphql";
import { Trans as I18n, useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { useCallback, useContext, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouteMatch } from "react-router-dom";
import getSlug from "../../getSlug";
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "@heroicons/react/outline";
import TextInput from "../../components/TextInput";
import Button from "../../components/Button";
import useMapboxGLDraw, {
  DigitizingState,
  EMPTY_FEATURE_COLLECTION,
} from "../../draw/useMapboxGLDraw";
import { MapContext } from "../../dataLayers/MapContextManager";
import DigitizingTools from "../../formElements/DigitizingTools";
import { ZoomToFeature } from "../../draw/MapSettingsPopup";
import { Feature } from "geojson";
import { toFeatureCollection } from "../../formElements/FormElement";
import useDialog from "../../components/useDialog";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Warning from "../../components/Warning";

const Trans = (props: any) => <I18n ns="sketching" {...props} />;

export default function SketchEditorModal({
  id,
  sketchClass,
  onCancel,
  onComplete,
}: {
  id?: number;
  sketchClass: SketchingDetailsFragment;
  onCancel: () => void;
  onComplete: (sketch: SketchTocDetailsFragment) => void;
}) {
  const { t } = useTranslation("sketching");
  const [left, setLeft] = useState(true);
  const baseRoute = useRouteMatch(`/${getSlug()}/app`);
  const mapContext = useContext(MapContext);
  const [feature, setFeature] = useState<Feature | null>(null);
  const [name, _setName] = useState("");
  const [nameErrors, setNameErrors] = useState<string | null>(null);
  const [submissionAttempted, setSubmissionAttempted] = useState(false);
  const setName = useCallback(
    (value: string) => {
      if (nameErrors?.length || submissionAttempted) {
        if (value.length > 0) {
          setNameErrors(null);
        } else {
          setNameErrors(t("You must name your sketch"));
        }
      }
      _setName(value);
    },
    [nameErrors, _setName]
  );

  const onError = useGlobalErrorHandler();
  const [createSketch, createSketchState] = useCreateSketchMutation({
    onError,
    update: (cache, { data }) => {
      if (data?.createSketch) {
        const sketch = data.createSketch;
        const results = cache.readQuery<SketchingQuery>({
          query: SketchingDocument,
          variables: {
            slug: getSlug(),
          },
        });
        if (results?.projectBySlug?.mySketches) {
          cache.writeQuery({
            query: SketchingDocument,
            variables: { slug: getSlug() },
            data: {
              ...results,
              projectBySlug: {
                ...results.projectBySlug,
                mySketches: [...results.projectBySlug.mySketches, sketch],
              },
            },
          });
        }
      }
    },
  });

  const draw = useMapboxGLDraw(
    mapContext.manager?.map,
    sketchClass.geometryType,
    feature ? toFeatureCollection([feature]) : EMPTY_FEATURE_COLLECTION,
    (feature) => {
      setFeature(feature);
    }
  );

  useEffect(() => {
    draw.create(false, true);
  }, []);

  useEffect(() => {
    if (!baseRoute?.isExact) {
      setLeft(false);
    }
  }, [baseRoute?.isExact, setLeft]);

  const { confirmDelete } = useDialog();

  const [geometryErrors, setGeometryErrors] = useState<string | null>(null);

  const onSubmit = useCallback(async () => {
    setSubmissionAttempted(true);
    if (!name || name.length < 1) {
      setNameErrors(t("You must name your sketch"));
      return;
    }

    if (draw.selfIntersects) {
      setGeometryErrors(t("You must fix problems with your geometry first"));
      return;
    }

    if (!feature) {
      setGeometryErrors(t("You must finish your geometry first"));
      return;
    }

    const response = await createSketch({
      variables: {
        name,
        sketchClassId: sketchClass.id,
        userGeom: feature,
      },
    });
    if (response.data?.createSketch) {
      onComplete(response.data.createSketch);
    }
  }, [onComplete, feature, name, sketchClass]);

  useEffect(() => {
    if (feature && !draw.selfIntersects && geometryErrors) {
      setGeometryErrors(null);
    }
  }, [feature, draw.selfIntersects, geometryErrors]);

  useEffect(() => {
    if (createSketchState.loading) {
      draw.disable();
    } else {
      draw.enable();
    }
  }, [draw.disable, draw.enable, createSketchState.loading, draw]);

  return (
    <>
      {createPortal(
        <motion.div
          initial={{ scale: 0.8, opacity: 0, left: 72 }}
          variants={{
            left: {
              scale: 1,
              opacity: 1,
              left: 72,
            },
            right: {
              scale: 1,
              opacity: 1,
              left: "calc(100vw - 520px)",
            },
          }}
          transition={{
            duration: 0.2,
            bounce: false,
          }}
          animate={left ? "left" : "right"}
          className={`w-128 bg-white rounder absolute top-2 z-10 rounded-lg shadow-xl flex-col overflow-hidden`}
          style={{ maxHeight: "calc(100vh - 200px)" }}
        >
          <h1 className="flex items-center p-4">
            <span className="flex-1">
              <span className="font-bold">
                {!id && <Trans>New</Trans>} {sketchClass.name}
              </span>
            </span>
            {!left && (
              <button onClick={() => setLeft(true)}>
                <ArrowLeftIcon className="w-6 h-6" />
              </button>
            )}
            {left && (
              <button onClick={() => setLeft(false)}>
                <ArrowRightIcon className="w-6 h-6" />
              </button>
            )}
          </h1>
          <div className="p-4 pt-0 flex-1 overflow-y-auto">
            <TextInput
              disabled={createSketchState.loading}
              error={nameErrors || undefined}
              autoFocus
              required={true}
              label={<Trans>Name</Trans>}
              value={name}
              onChange={(value) => setName(value)}
              name="name"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  onSubmit();
                }
              }}
            />
            {geometryErrors && <Warning>{geometryErrors}</Warning>}
          </div>
          <div className="space-x-2 bg-gray-100 p-4 border-t">
            <Button onClick={onCancel} label={<Trans>Cancel</Trans>} />
            <Button
              loading={createSketchState.loading}
              disabled={createSketchState.loading}
              onClick={onSubmit}
              label={<Trans>Submit</Trans>}
              primary
            />
          </div>
        </motion.div>,
        document.body
      )}
      {mapContext.containerPortal &&
        createPortal(
          <div className="flex items-center justify-center w-screen h-full">
            <DigitizingTools
              multiFeature={false}
              isSketchingWorkflow={true}
              selfIntersects={draw.selfIntersects}
              onRequestResetFeature={() => {
                draw.setCollection(EMPTY_FEATURE_COLLECTION);
                draw.create(false, true);
              }}
              onRequestFinishEditing={draw.actions.finishEditing}
              geometryType={sketchClass.geometryType}
              state={draw.digitizingState}
              onRequestSubmit={() => {}}
              onRequestDelete={() => {
                confirmDelete({
                  message: t("Delete Geometry"),
                  description: t(
                    "Are you sure you want to start over and redraw your sketch?"
                  ),
                  onDelete: async (value) => {
                    draw.setCollection(EMPTY_FEATURE_COLLECTION);
                    draw.create(false, true);
                  },
                });
              }}
              onRequestEdit={draw.actions.edit}
            >
              <ZoomToFeature
                map={mapContext.manager?.map!}
                // feature={}
                isSmall={false}
                geometryType={sketchClass.geometryType}
              />
            </DigitizingTools>
          </div>,
          mapContext.containerPortal
        )}
    </>
  );
}
