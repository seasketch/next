import { AnimatePresence, motion } from "framer-motion";
import gql from "graphql-tag";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { components } from "../../formElements";
import {
  FormElementBackgroundImagePlacement,
  FormElementTextVariant,
  FormElementType,
  useAddFormElementMutation,
} from "../../generated/graphql";

interface Props {
  onAdd: (id: number) => void;
  formId: number;
  types: Omit<FormElementType, "nodeId" | "isRequiredForSurveys">[];
  /** Specify the highest position in the current form + 1 to add items to the end of the form */
  nextPosition: number;
}

export default function AddFormElementButton({
  onAdd,
  formId,
  types,
  nextPosition,
}: Props) {
  const { t } = useTranslation("admin:surveys");
  const [menuOpen, setMenuOpen] = useState(false);
  const onError = useGlobalErrorHandler();
  const [addFormElement, addFormElementState] = useAddFormElementMutation({
    onError,
  });
  return (
    <>
      <Button
        className=""
        small
        label={t("Add")}
        onClick={() => setMenuOpen(true)}
      />
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            transition={{ duration: 0.1 }}
            initial={{ background: "rgba(0,0,0,0)" }}
            animate={{ background: "rgba(0,0,0,0.1)" }}
            exit={{ background: "rgba(0,0,0,0)" }}
            className={`absolute top-0 left-0 z-50 w-screen h-screen bg-opacity-5 bg-black`}
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              transition={{ duration: 0.1 }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute left-56 ml-2 p-0 top-28 mt-2 max-h-128 overflow-y-auto bg-white rounded shadow "
            >
              {Object.entries(components)
                .filter(([id, C]) => !C.templatesOnly)
                .map(([id, C]) => (
                  <div
                    key={id}
                    className="py-4 px-4 cursor-pointer my-2 hover:bg-cool-gray-100"
                    onClick={async () => {
                      const result = await addFormElement({
                        variables: {
                          body: C.defaultBody,
                          componentSettings: C.defaultComponentSettings || {},
                          formId: formId,
                          componentType: id,
                          exportId: C.defaultExportId,
                        },
                        optimisticResponse: {
                          __typename: "Mutation",
                          createFormElement: {
                            __typename: "CreateFormElementPayload",
                            formElement: {
                              __typename: "FormElement",
                              body: C.defaultBody,
                              componentSettings:
                                C.defaultComponentSettings || {},
                              formId,
                              typeId: id,
                              isRequired: false,
                              position: nextPosition,
                              conditionalRenderingRules: [],
                              type: {
                                ...types.find((t) => t.componentName === id)!,
                              },
                              id: 9999999999,
                              exportId:
                                C.defaultExportId || "loading-" + nextPosition,
                              backgroundColor: null,
                              backgroundImage: null,
                              backgroundImagePlacement:
                                FormElementBackgroundImagePlacement.Top,
                              textVariant: FormElementTextVariant.Dynamic,
                              backgroundPalette: null,
                            },
                          },
                        },
                        update: (cache, { data }) => {
                          if (data?.createFormElement?.formElement) {
                            const newElementData =
                              data.createFormElement.formElement;
                            cache.modify({
                              id: cache.identify({
                                __typename: "Form",
                                id: formId,
                              }),
                              fields: {
                                formElements(existingRefs = [], { readField }) {
                                  const newRef = cache.writeFragment({
                                    data: newElementData,
                                    fragment: gql`
                                      fragment NewElement on FormElement {
                                        body
                                        componentSettings
                                        conditionalRenderingRules {
                                          id
                                          field {
                                            id
                                            exportId
                                          }
                                          operator
                                          predicateFieldId
                                          value
                                        }
                                        exportId
                                        formId
                                        id
                                        isRequired
                                        position
                                        type {
                                          componentName
                                          isHidden
                                          isInput
                                          isSingleUseOnly
                                          isSurveysOnly
                                          label
                                        }
                                        typeId
                                      }
                                    `,
                                  });

                                  return [...existingRefs, newRef];
                                },
                              },
                            });
                          }
                        },
                      });
                      if (
                        onAdd &&
                        result.data?.createFormElement?.formElement
                      ) {
                        onAdd(result.data.createFormElement.formElement.id);
                      }
                    }}
                  >
                    <div className="text-base font-medium text-gray-800">
                      {C.label}
                    </div>
                    <div className="text-sm text-gray-800">{C.description}</div>
                  </div>
                ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
