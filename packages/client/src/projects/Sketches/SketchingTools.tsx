import Button from "../../components/Button";
import DropdownButton, {
  DropdownOption,
} from "../../components/DropdownButton";
import {
  ProjectAppSidebarContext,
  ProjectAppSidebarToolbar,
} from "../ProjectAppSidebar";
import { Trans as I18n, useTranslation } from "react-i18next";
import getSlug from "../../getSlug";
import {
  SketchingDetailsFragment,
  SketchingDocument,
  SketchingQuery,
  useCreateSketchFolderMutation,
  useSketchingQuery,
} from "../../generated/graphql";
import { useContext, useMemo, useState, useEffect } from "react";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import useDialog from "../../components/useDialog";
import SketchTableOfContents from "./SketchTableOfContents";
import SketchEditorModal from "./SketchEditorModal";
import { useHistory } from "react-router-dom";
import { memo } from "react";

const Trans = (props: any) => <I18n ns="sketching" {...props} />;

export default memo(function SketchingTools({ hidden }: { hidden?: boolean }) {
  const { t } = useTranslation("sketching");
  const { data } = useSketchingQuery({
    variables: {
      slug: getSlug(),
    },
  });
  const onError = useGlobalErrorHandler();
  const [createFolder] = useCreateSketchFolderMutation({
    onError,
  });

  const { isSmall } = useContext(ProjectAppSidebarContext);

  const { prompt } = useDialog();

  const [editor, setEditor] =
    useState<false | { id?: number; sketchClass: SketchingDetailsFragment }>(
      false
    );

  const [toolbarRef, setToolbarRef] = useState<HTMLDivElement | null>(null);

  const history = useHistory();
  const sketchClassOptions = useMemo(() => {
    const sketchClasses = [...(data?.projectBySlug?.sketchClasses || [])];
    return [
      ...sketchClasses
        .filter((sc) => !sc.formElementId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(
          (sc) =>
            ({
              label: sc.name,
              onClick: () => {
                history.replace(`/${getSlug()}/app`);
                setEditor({
                  sketchClass: sc,
                });
              },
            } as DropdownOption)
        ),
      {
        label: <Trans>Folder</Trans>,
        onClick: () => {
          prompt({
            message: t(`What would you like to name your folder?`),
            onSubmit: async (name) => {
              await createFolder({
                variables: {
                  name,
                  slug: getSlug(),
                },
                update: (cache, { data }) => {
                  if (data?.createSketchFolder?.sketchFolder) {
                    const folder = data.createSketchFolder.sketchFolder;
                    const results = cache.readQuery<SketchingQuery>({
                      query: SketchingDocument,
                      variables: {
                        slug: getSlug(),
                      },
                    });
                    if (results?.projectBySlug?.myFolders) {
                      cache.writeQuery({
                        query: SketchingDocument,
                        variables: { slug: getSlug() },
                        data: {
                          ...results,
                          projectBySlug: {
                            ...results.projectBySlug,
                            myFolders: [
                              ...results.projectBySlug.myFolders,
                              folder,
                            ],
                          },
                        },
                      });
                    }
                  }
                },
              });
            },
          });
        },
      } as DropdownOption,
    ];
  }, [data?.projectBySlug?.sketchClasses, createFolder, prompt, t]);

  return (
    <div style={{ display: hidden ? "none" : "block" }}>
      {!hidden && (
        <ProjectAppSidebarToolbar ref={(el) => setToolbarRef(el)}>
          <DropdownButton
            small
            alignment="left"
            label={
              isSmall ? <Trans>Create</Trans> : <Trans>Create New...</Trans>
            }
            options={sketchClassOptions}
            disabled={editor !== false}
          />
          <Button disabled small label={<Trans>Edit</Trans>} />
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <Button disabled small label={<Trans>Delete</Trans>} />
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <Button
            disabled
            small
            label={
              isSmall ? (
                <Trans>Attributes</Trans>
              ) : (
                <Trans>View Attributes and Reports</Trans>
              )
            }
          />
        </ProjectAppSidebarToolbar>
      )}
      <SketchTableOfContents
        folders={data?.projectBySlug?.myFolders || []}
        sketches={data?.projectBySlug?.mySketches || []}
        ignoreClicksOnRefs={toolbarRef ? [toolbarRef] : []}
      />
      {editor && (
        <SketchEditorModal
          sketchClass={editor.sketchClass}
          id={editor.id}
          onComplete={() => {
            history.replace(`/${getSlug()}/app/sketches`);
            setEditor(false);
          }}
          onCancel={() => {
            history.replace(`/${getSlug()}/app/sketches`);
            setEditor(false);
          }}
        />
      )}
    </div>
  );
});
