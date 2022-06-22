import { AnimatePresence, motion } from "framer-motion";
import gql from "graphql-tag";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { components } from "../../formElements";
import {
  FormElementLayout,
  FormElementTextVariant,
  useAddFormElementMutation,
  useFormElementTypesQuery,
} from "../../generated/graphql";

interface Props {
  onAdd: (id: number) => void;
  formId: number;
  formIsSketchClass: boolean;
  existingTypes: string[];
  /** Specify the highest position in the current form + 1 to add items to the end of the form */
  nextPosition: number;
  heading?: string;
  label?: string;
  subordinateTo?: number;
}

export default function AddFormElementButton({
  onAdd,
  formId,
  nextPosition,
  existingTypes,
  heading,
  formIsSketchClass,
  label,
  subordinateTo,
}: Props) {
  const { t } = useTranslation("admin:surveys");
  const [menuOpen, setMenuOpen] = useState(false);
  const onError = useGlobalErrorHandler();
  const [addFormElement] = useAddFormElementMutation({
    onError,
  });

  const { data } = useFormElementTypesQuery({ onError });

  return (
    <>
      <Button
        className=""
        small
        label={label || t("Add")}
        onClick={() => setMenuOpen(true)}
      />
      <AnimatePresence>
        {menuOpen && data?.formElementTypes && (
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
              className="absolute left-56 ml-2 p-0 top-28 mt-2 max-h-128 overflow-y-auto bg-white rounded shadow pr-2"
            >
              {heading && <h4 className="px-4 pt-4 text-lg">{heading}</h4>}
              {Object.entries(components)
                .filter(([id, C]) => !C.templatesOnly)
                .filter(([id, C]) => {
                  const type = data.formElementTypes!.find(
                    (t) => t.componentName === id
                  );
                  if (
                    (formIsSketchClass || subordinateTo) &&
                    (type?.isSurveysOnly || type?.isSpatial)
                  ) {
                    return false;
                  }
                  if (type && type.isSingleUseOnly) {
                    if (existingTypes.indexOf(id) !== -1) {
                      return false;
                    }
                  }
                  return true;
                })
                .map(([id, C]) => (
                  <div
                    key={id}
                    className="py-4 px-4 cursor-pointer my-2 hover:bg-cool-gray-100 flex items-center"
                    onClick={async () => {
                      const result = await addFormElement({
                        variables: {
                          body: C.defaultBody,
                          componentSettings: C.defaultComponentSettings || {},
                          formId: formId,
                          componentType: id,
                          exportId: C.defaultExportId,
                          subordinateTo: subordinateTo,
                          isRequired: C.defaultIsRequired || false,
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
                              alternateLanguageSettings: {},
                              formId,
                              typeId: id,
                              isRequired: C.defaultIsRequired || false,
                              position: nextPosition,
                              type: {
                                ...data.formElementTypes!.find(
                                  (t) => t.componentName === id
                                )!,
                              },
                              id: 9999999999,
                              exportId:
                                C.defaultExportId || "loading-" + nextPosition,
                              backgroundColor: null,
                              backgroundImage: null,
                              layout: FormElementLayout.Top,
                              textVariant: FormElementTextVariant.Dynamic,
                              backgroundPalette: null,
                              jumpToId: null,
                              secondaryColor: null,
                              unsplashAuthorName: null,
                              unsplashAuthorUrl: null,
                              backgroundHeight: null,
                              backgroundWidth: null,
                              subordinateTo: subordinateTo || null,
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
                                        exportId
                                        formId
                                        id
                                        isRequired
                                        position
                                        jumpToId
                                        type {
                                          componentName
                                          isHidden
                                          isInput
                                          isSingleUseOnly
                                          isSurveysOnly
                                          label
                                          supportedOperators
                                        }
                                        typeId
                                        backgroundColor
                                        secondaryColor
                                        backgroundImage
                                        layout
                                        backgroundPalette
                                        textVariant
                                        unsplashAuthorUrl
                                        unsplashAuthorName
                                        backgroundWidth
                                        backgroundHeight
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
                    <div className="w-8 h-8 rounded overflow-hidden mr-4">
                      <C.icon
                        componentSettings={C.defaultComponentSettings || {}}
                      />
                    </div>
                    <div>
                      <div className="text-base font-medium text-gray-800">
                        {C.label}
                      </div>
                      <div className="text-sm text-gray-800">
                        {C.description}
                      </div>
                    </div>
                  </div>
                ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
