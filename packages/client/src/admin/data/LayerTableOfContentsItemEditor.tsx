import React from "react";
import TextInput from "../../components/TextInput";
import {
  useGetLayerItemQuery,
  useUpdateTableOfContentsItemMutation,
  useUpdateDataSourceMutation,
  RenderUnderType,
  useUpdateLayerMutation,
  AccessControlListType,
} from "../../generated/graphql";
import { useTranslation, Trans } from "react-i18next";
import TableOfContentsItemAutosaveInput from "./TableOfContentsItemAutosaveInput";
import Spinner from "../../components/Spinner";
import MutableAutosaveInput from "../MutableAutosaveInput";
import RadioGroup, { MutableRadioGroup } from "../../components/RadioGroup";
import AccessControlListEditor from "../../components/AccessControlListEditor";

interface LayerTableOfContentsItemEditorProps {
  itemId: number;
  onRequestClose?: () => void;
}

export default function LayerTableOfContentsItemEditor(
  props: LayerTableOfContentsItemEditorProps
) {
  const { t } = useTranslation(["admin"]);
  const { data, loading, error } = useGetLayerItemQuery({
    variables: {
      id: props.itemId,
    },
  });
  const [mutateItem, mutateItemState] = useUpdateTableOfContentsItemMutation();
  const [mutateSource, mutateSourceState] = useUpdateDataSourceMutation();
  const [mutateLayer, mutateLayerState] = useUpdateLayerMutation();

  const item = data?.tableOfContentsItem;
  const layer = item?.dataLayer;
  const source = layer?.dataSource;
  return (
    <div
      className="bg-white z-20 absolute bottom-0 w-128 border p-4"
      style={{ height: "calc(100%)" }}
    >
      <div className="">
        <button
          className="bg-gray-300 float-right rounded-full p-1 cursor-pointer focus:ring-blue-300"
          onClick={props.onRequestClose}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            className="w-5 h-5 text-white"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <h4 className="font-medium text-gray-500 mb-2">Edit Layer</h4>
      </div>
      {!item && <Spinner />}
      {item && (
        <>
          <div className="md:max-w-sm mt-5">
            <MutableAutosaveInput
              autofocus
              mutation={mutateItem}
              mutationStatus={mutateItemState}
              propName="title"
              value={item?.title || ""}
              label={t("Title")}
              variables={{ id: props.itemId }}
            />
          </div>
          <div className="md:max-w-sm mt-5">
            <MutableAutosaveInput
              propName="attribution"
              mutation={mutateSource}
              mutationStatus={mutateSourceState}
              value={source?.attribution || ""}
              label={t("Attribution")}
              description={t(
                "If set, a short attribution string will be shown at the bottom of the map."
              )}
              variables={{ id: source?.id }}
            />
          </div>
          <div className="mt-5">
            {item.acl?.nodeId && (
              <AccessControlListEditor nodeId={item.acl?.nodeId} />
            )}
            {/* <MutableRadioGroup
              value={item.acl?.type || AccessControlListType.Public}
              legend={t(`Access Control`)}
              mutate={mutateItem}
              mutationStatus={mutateItemState}
              propName={"access"}
              variables={{ id: props.itemId }}
              items={[
                {
                  value: AccessControlListType.Public,
                  label: "Public",
                  description:
                    "Available to everyone who can access the project",
                },
                {
                  value: AccessControlListType.AdminsOnly,
                  label: "Admins Only",
                  // description: "Only project administrators will see it",
                },
                {
                  value: AccessControlListType.Group,
                  label: "Group List",
                  description:
                    "Accessible to users in the following groups and project admins",
                },
              ]}
            /> */}
          </div>
          <div className="mt-5">
            <MutableRadioGroup
              value={layer?.renderUnder}
              legend={t(`Z-Order Setting`)}
              mutate={mutateLayer}
              mutationStatus={mutateLayerState}
              propName={"renderUnder"}
              variables={{ id: layer?.id }}
              items={[
                {
                  value: RenderUnderType.Labels,
                  label: "Show Under Labels",
                  description:
                    "Display this layer under any text labels on the basemap.",
                },
                {
                  value: RenderUnderType.Land,
                  label: "Show Under Land",
                  description:
                    "Useful when you want to present data that may not have a matching shoreline.",
                },
                {
                  value: RenderUnderType.None,
                  label: "Cover Basemap",
                  description: "Render this layer above the basemap entirely.",
                },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
