import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import {
  FormElementDetailsFragment,
  SketchClassFormDocument,
  useAddFormElementMutation,
} from "../../generated/graphql";
import { useMemo, useState } from "react";
import Button from "../../components/Button";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { questionBodyFromMarkdown } from "../../formElements/fromMarkdown";
import { FilterServiceMetadata } from "../../formElements/FilterInputContext";

export default function FilterAttributesManagementModal({
  metadata,
  onRequestClose,
  formElements,
  formId,
}: {
  metadata: FilterServiceMetadata;
  onRequestClose: () => void;
  formElements: FormElementDetailsFragment[];
  formId: number;
}) {
  const { t } = useTranslation("admin:sketching");
  const onError = useGlobalErrorHandler();
  const [addFormElement, addFormElementState] = useAddFormElementMutation({
    onError,
    refetchQueries: [SketchClassFormDocument],
  });
  const [selected, setSelected] = useState<{ [key: string]: true }>({});
  const includedAttributes = useMemo(() => {
    const attributeNames = metadata.attributes.map((a) => a.attribute);
    const attrs = new Set<string>();
    for (const element of formElements) {
      if (
        element.componentSettings?.attribute &&
        element.type?.componentName === "FilterInput" &&
        attributeNames.includes(element.componentSettings?.attribute)
      ) {
        attrs.add(element.componentSettings?.attribute);
      }
    }
    return attrs;
  }, [formElements, metadata]);

  return (
    <Modal
      disableBackdropClick
      zeroPadding
      // title={t("Filter Attributes Management")}
      onRequestClose={onRequestClose}
      footer={[
        {
          label: t("Cancel"),
          onClick: onRequestClose,
          disabled: addFormElementState.loading,
        },
        {
          label:
            t("Create Filter Inputs") +
            (Object.keys(selected).length > 0
              ? " (" + Object.keys(selected).length + ")"
              : ""),
          variant: "primary",
          loading: addFormElementState.loading,
          disabled:
            Object.keys(selected).length < 1 || addFormElementState.loading,
          onClick: async () => {
            await Promise.all(
              Object.keys(selected)
                .sort()
                .map(async (attribute) => {
                  const attrMetadata = metadata.attributes.find(
                    (a) => a.attribute === attribute
                  );
                  if (!attrMetadata) {
                    throw new Error(
                      `Attribute ${attribute} not found in metadata`
                    );
                  }
                  return await addFormElement({
                    variables: {
                      componentSettings: {
                        attribute,
                      },
                      componentType: "FilterInput",
                      isRequired: false,
                      formId,
                      exportId: attrMetadata.attribute,
                      body: questionBodyFromMarkdown(`# ${attribute}`),
                    },
                  });
                })
            );
            onRequestClose();
          },
        },
      ]}
    >
      <div className="">
        <h3 className="text-lg p-4 pb-0">{t("Filter Management")}</h3>
        <p className="text-sm p-4">
          <Trans>
            The following list includes all attributes that the bound filter
            service supports. Choose attributes you would like to filter on, and
            SeaSketch will create new form fields to support filtering these
            attributes. Those form fields can then be customized and sorted as
            needed.
          </Trans>
        </p>
        <div className="px-4 pb-4">
          <Button
            autofocus
            onClick={() => {
              if (Object.keys(selected).length > 0) {
                setSelected({});
              } else {
                const newSelected: { [key: string]: true } = {};
                metadata.attributes.forEach((a) => {
                  if (a.attribute !== "id") {
                    newSelected[a.attribute] = true;
                  }
                });
                setSelected(newSelected);
              }
            }}
            small
            label={t("Toggle All")}
          />
        </div>
        <div className="w-full h-64 overflow-y-auto px-4">
          <form id="filters" autoFocus>
            <ul>
              {metadata.attributes
                .filter((a) => a.attribute !== "id")
                .map((attribute) => {
                  const included = includedAttributes.has(attribute.attribute);
                  const isSelected = attribute.attribute in selected;
                  return (
                    <li key={attribute.attribute} className="p-1">
                      <label
                        className={`flex items-center space-x-2 text-sm ${
                          included ? "opacity-30" : "opacity-100"
                        }`}
                      >
                        <input
                          disabled={included}
                          type="checkbox"
                          name={attribute.attribute}
                          checked={included || isSelected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelected((prev) => {
                              if (checked) {
                                return { ...prev, [attribute.attribute]: true };
                              } else {
                                const { [attribute.attribute]: _, ...rest } =
                                  prev;
                                return rest;
                              }
                            });
                          }}
                        />
                        <span>
                          {attribute.attribute} ({attribute.type})
                        </span>
                      </label>
                    </li>
                  );
                })}
            </ul>
          </form>
        </div>
      </div>
    </Modal>
  );
}
