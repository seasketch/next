import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import {
  useProjectMetadataQuery,
  useUpdateAboutPageContentsMutation,
} from "../generated/graphql";
import { ProseMirror, useProseMirror } from "use-prosemirror";
import { aboutPage as editorConfig } from "../editor/config";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorView } from "prosemirror-view";
import { Node, Slice } from "prosemirror-model";
import { EditorState, Transaction } from "prosemirror-state";
import EditorMenuBar from "../editor/EditorMenuBar";
import languages from "../lang/supported";
import { useDebouncedFn } from "beautiful-react-hooks";
import useDebounce from "../useDebounce";

const { schema, plugins } = editorConfig;

export default function AboutPageSettings() {
  const { t, i18n } = useTranslation("admin");
  const { slug } = useParams<{ slug: string }>();
  const { data, loading } = useProjectMetadataQuery({
    variables: { slug },
  });
  const [mutate, mutationState] = useUpdateAboutPageContentsMutation();
  const [state, setState] = useProseMirror({ schema });
  const [changes, setChanges] = useState(false);
  const viewRef = useRef<{ view: EditorView }>();
  const [lang, setLang] = useState("EN");

  const debouncedDoc = useDebounce(state.doc, 500);
  console.log(
    loading,
    JSON.stringify(
      data?.project?.aboutPageContents?.[lang]?.content?.[0]?.content
    )
  );

  // TODO: Problem here with cached projectmetadata setting the contents of the
  // editor, and then being updated by the network. stale content shows up after
  // refresh.
  useEffect(() => {
    const doc = data?.project?.aboutPageContents?.[lang];
    return;
    if (state && doc && state.doc) {
      try {
        console.log("dispatching", state.doc);
        const node = Node.fromJSON(schema, doc);
        // const t = state.tr;
        // state.tr.replace(
        //   0,
        //   state.doc.content.size,
        //   new Slice(node.content, 0, 0)
        // );

        // t.doc = node;
        // console.log("t", t, node);
        // t.replace(0, state.doc.nodeSize, new Slice(node.content, 0, 0));
        // // t.replaceRangeWith(0, state.doc.nodeSize, node);
        // console.log(t);
        // viewRef.current?.view.dispatch(t);
        const newState = EditorState.create({
          ...state,
          schema: state.schema,
          plugins: state.plugins,
          doc: node,
          selection: state.selection,
        });
        onChange(newState);
      } catch (e) {
        // do nothing
        // console.error(e);
        throw e;
      }
    }
  }, [data?.project?.aboutPageContents, lang]);

  useEffect(() => {
    if (!loading) {
      const startingDocument = data?.project?.aboutPageContents?.[lang];
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
  }, [loading, setState, lang]);

  const [hasChanges, setHasChanges] = useState(false);

  const onChange = useCallback(
    (state: EditorState) => {
      setState(state);
      setHasChanges(true);
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
      setHasChanges(false);
    }
  }, [debouncedDoc]);

  return (
    <>
      <div className="relative">
        <div className="shadow sm:rounded-md sm:overflow-hidden">
          <div className="px-4 py-5 bg-white sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              {t("About Page")}
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
            <div className="py-4">
              <div className="bg-gray-50 rounded shadow">
                <EditorMenuBar
                  view={viewRef.current?.view}
                  state={state}
                  schema={schema}
                >
                  <div className="border-r-1 w-1 border-gray-300 border-r h-5 mx-2"></div>
                  <select className="text-sm ml-2 px-3 py-0.5 rounded border-gray-300">
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
                  className="metadata small-variant"
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
