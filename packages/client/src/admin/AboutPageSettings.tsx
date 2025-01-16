import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import {
  useProjectMetadataQuery,
  useUpdateAboutPageContentsMutation,
  useUpdateAboutPageEnabledMutation,
} from "../generated/graphql";
import { ProseMirror, useProseMirror } from "use-prosemirror";
import { createAboutPageEditorConfig } from "../editor/config";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorView } from "prosemirror-view";
import { Node } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import EditorMenuBar from "../editor/EditorMenuBar";
import languages from "../lang/supported";
import useDebounce from "../useDebounce";
import MutationStateCheckmarkIndicator from "../components/MutationStateCheckmarkIndicator";
import Switch from "../components/Switch";

import "prosemirror-image-plugin/dist/styles/common.css";
import "./prosemirror-image.css";
import { useApolloClient } from "@apollo/client";
import { startImageUpload } from "prosemirror-image-plugin";

export default function AboutPageSettings({
  projectId,
}: {
  projectId: number;
}) {
  const { t } = useTranslation("admin");
  const { slug } = useParams<{ slug: string }>();
  const { data, loading } = useProjectMetadataQuery({
    variables: { slug },
  });

  const client = useApolloClient();

  const { schema, plugins, imageSettings } = useMemo(() => {
    return createAboutPageEditorConfig(client, projectId);
  }, [client, projectId]);

  const [mutate, mutationState] = useUpdateAboutPageContentsMutation();
  const [enableMutate] = useUpdateAboutPageEnabledMutation();
  const [state, setState] = useProseMirror({ schema });
  const viewRef = useRef<{ view: EditorView }>();

  const [lang, setLang] = useState("EN");

  const debouncedDoc = useDebounce(state.doc, 500);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const doc = data?.project?.aboutPageContents?.[lang];
    if (state && doc && state.doc && !hasChanges) {
      try {
        const node = Node.fromJSON(schema, doc);
        const newState = EditorState.create({
          ...state,
          schema: state.schema,
          plugins: state.plugins,
          doc: node,
          selection: state.selection,
        });
        setState(newState);
      } catch (e) {
        // do nothing
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.project?.aboutPageContents]);

  useEffect(() => {
    if (!loading) {
      let startingDocument: any = data?.project?.aboutPageContents?.["EN"];
      if (lang !== "EN" && lang in data?.project?.aboutPageContents) {
        startingDocument = data?.project?.aboutPageContents?.[lang];
      }
      try {
        const doc = startingDocument
          ? Node.fromJSON(schema, startingDocument)
          : undefined;
        // initial render
        const state = EditorState.create({
          schema: schema,
          plugins,
          doc,
        });
        setState(state);
        setHasChanges(false);
      } catch (e) {
        const doc = startingDocument
          ? Node.fromJSON(schema, {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Problem parsing metadata" }],
                },
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: e.toString(),
                    },
                  ],
                },
              ],
            })
          : undefined;
        // initial render
        const state = EditorState.create({
          schema: schema,
          plugins,
          doc,
        });
        setState(state);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, setState, lang]);

  const onChange = useCallback(
    (state: EditorState) => {
      setHasChanges(true);
      setState(state);
    },
    [setState]
  );

  useEffect(() => {
    if (debouncedDoc && hasChanges) {
      mutate({
        variables: {
          content: debouncedDoc?.toJSON(),
          lang,
          slug,
        },
      });
    }
  }, [debouncedDoc]);

  const enabled = data?.project?.aboutPageEnabled;

  return (
    <>
      <div className="relative">
        <div className="shadow sm:rounded-md sm:overflow-hidden">
          <div className="px-4 py-5 bg-white sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900 flex items-center space-x-2 py-1">
              <span>{t("About Page")}</span>
              <MutationStateCheckmarkIndicator
                state={
                  mutationState.called
                    ? mutationState.loading
                      ? "SAVING"
                      : "SAVED"
                    : "NONE"
                }
                error={mutationState.error?.message}
              />
              <div className="flex-1 flex items-center justify-end">
                <Switch
                  onClick={(enable) =>
                    enableMutate({
                      variables: {
                        enabled: enable,
                        slug,
                      },
                    })
                  }
                  isToggled={enabled}
                />
              </div>
            </h3>
            {/* {mutationState.error && <p>{mutationState.error.message}</p>} */}
            <p className="mt-1 text-sm leading-5 text-gray-500">
              <Trans ns="admin">
                When enabled, the about page will be accessible from the project
                sidebar. It will also be presented to users when they first
                visit the project. If your project supports multiple languages,
                use the dropdown to switch between languages and provide
                translated content.
              </Trans>
            </p>
            <div
              className={`py-4 ${
                enabled ? "" : "opacity-10 pointer-events-none"
              }`}
              aria-disabled={!enabled}
            >
              <div className="bg-gray-50 rounded shadow">
                <EditorMenuBar
                  view={viewRef.current?.view}
                  state={state}
                  schema={schema}
                  // @ts-ignore
                  createImageUpload={async (file, altText) => {
                    if (viewRef.current?.view) {
                      startImageUpload(
                        viewRef.current!.view,
                        file,
                        altText || "",
                        imageSettings,
                        schema
                      );
                      return {};
                    } else {
                      throw new Error("No editor view");
                    }
                  }}
                >
                  <div className="border-r-1 w-1 border-gray-300 border-r h-5 mx-2"></div>
                  <select
                    className="text-sm ml-2 px-3 py-0.5 pr-8 rounded border-gray-300"
                    onChange={(e) => setLang(e.target.value)}
                  >
                    <option value="EN">{t("English")}</option>
                    {data?.project?.supportedLanguages?.map((l) => {
                      const lang = languages.find((lang) => lang.code === l);
                      if (!lang) {
                        return null;
                      }
                      return (
                        <option key={l} value={l!}>
                          {lang.localName || lang.name}
                        </option>
                      );
                    })}
                  </select>
                </EditorMenuBar>
              </div>

              <div className="pt-4 flex-1 overflow-y-auto">
                <ProseMirror
                  // style={{ height: 800 }}
                  className={`metadata about-editor ${
                    enabled ? "h-64" : "h-12 overlflow-y-hidden"
                  }`}
                  state={state}
                  onChange={onChange}
                  // @ts-ignore
                  ref={viewRef}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
