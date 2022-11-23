import TextInput from "../../components/TextInput";
import {
  SketchingDetailsFragment,
  useUpdateSketchClassMutation,
  useDeleteSketchClassMutation,
  SketchClassesQuery,
  SketchClassesDocument,
} from "../../generated/graphql";
import { Trans as I18n, useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import MutableAutosaveInput from "../MutableAutosaveInput";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import AccessControlListEditor from "../../components/AccessControlListEditor";
import { useCallback } from "react";
import Button from "../../components/Button";
import useDialog from "../../components/useDialog";
import getSlug from "../../getSlug";
import { SketchClassTemplateIcon } from "./TemplateChooser";

const Trans = (props: any) => <I18n ns="admin:sketching" {...props} />;

export default function SketchClassForm({
  sketchClass,
  onDelete,
}: {
  sketchClass: SketchingDetailsFragment;
  onDelete?: (id: number) => void;
}) {
  const onError = useGlobalErrorHandler();
  const [mutate, mutationState] = useUpdateSketchClassMutation({
    variables: {
      id: sketchClass.id,
    },
    onError,
  });

  const { confirmDelete } = useDialog();

  const [del, deleteState] = useDeleteSketchClassMutation({
    variables: {
      id: sketchClass.id,
    },
    update: (cache, { data }) => {
      const deletedId = data?.deleteSketchClass?.sketchClass?.id;
      if (deletedId) {
        const existingSketchClasses = cache.readQuery<SketchClassesQuery>({
          query: SketchClassesDocument,
          variables: {
            slug: getSlug(),
          },
        });
        if (existingSketchClasses?.projectBySlug?.sketchClasses) {
          const filtered = [
            ...existingSketchClasses.projectBySlug.sketchClasses.filter(
              (sc) => sc.id !== deletedId
            ),
          ];
          cache.writeQuery({
            query: SketchClassesDocument,
            data: {
              ...existingSketchClasses,
              projectBySlug: {
                ...existingSketchClasses.projectBySlug,
                sketchClasses: filtered,
              },
            },
          });
          if (onDelete) {
            onDelete(deletedId);
          }
        }
      }
    },
  });

  const toggleArchived = useCallback(() => {
    const isArchived = !sketchClass.isArchived;
    mutate({
      variables: {
        id: sketchClass.id,
        isArchived,
      },
      optimisticResponse: (d) => {
        return {
          __typename: "Mutation",
          updateSketchClass: {
            __typename: "UpdateSketchClassPayload",
            sketchClass: {
              __typename: "SketchClass",
              ...sketchClass,
              isArchived,
            },
          },
        };
      },
    });
  }, [sketchClass, mutate]);
  return (
    <div className="bg-white p-4 flex-1 max-w-xl shadow space-y-4">
      <h1 className="text-lg font-semibold flex items-center">
        <span className="flex-1">
          <Trans>Sketch class settings</Trans>
        </span>
        <SketchClassTemplateIcon
          geometryType={sketchClass.geometryType}
          name=""
          color="text-gray-500"
        />
      </h1>
      <div className="">
        <MutableAutosaveInput
          value={sketchClass.name}
          label={<Trans>Name</Trans>}
          mutation={mutate}
          mutationStatus={mutationState}
          propName="name"
        />
      </div>
      {sketchClass.acl?.nodeId && (
        <AccessControlListEditor nodeId={sketchClass.acl?.nodeId} />
      )}
      <div className="">
        <InputBlock
          input={
            <Switch
              isToggled={sketchClass.isArchived}
              onClick={toggleArchived}
            />
          }
          title={<Trans>Archive</Trans>}
          description={
            <Trans>
              Enable if you would like to disable and hide this sketch class.
              Existing sketches will not be deleted but new ones cannot be
              drawn.
            </Trans>
          }
        />
      </div>
      <InputBlock
        input={
          <Button
            disabled={sketchClass.sketchCount >= 10}
            label={<Trans>Delete</Trans>}
            onClick={async () => {
              if (sketchClass.sketchCount < 10) {
                confirmDelete({
                  message:
                    "Are you sure you want to delete this Sketch Class and all associated sketches?",
                  onDelete: async () => {
                    await del();
                  },
                });
              }
            }}
          />
        }
        title={<Trans>Delete Sketch Class</Trans>}
        description={
          sketchClass.sketchCount < 10 ? (
            <Trans>
              This Sketch Class can still be deleted since it has fewer than 10
              sketches. All related sketches will be deleted.
            </Trans>
          ) : (
            <Trans>
              You can only delete sketch classes if they have not been used to
              create more than 10 sketches.
            </Trans>
          )
        }
      />
    </div>
  );
}
