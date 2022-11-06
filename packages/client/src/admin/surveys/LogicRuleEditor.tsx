import { PlusIcon, TrashIcon } from "@heroicons/react/outline";
import gql from "graphql-tag";
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import useDialog from "../../components/useDialog";
import { components } from "../../formElements";
import {
  adminValueInputCommonClassNames,
  defaultFormElementIcon,
} from "../../formElements/FormElement";
import {
  FieldRuleOperator,
  Form,
  FormLogicCommand,
  FormLogicCondition,
  FormLogicOperator,
  LogicRuleEditorRuleFragment,
  useCreateLogicRuleForSurveyMutation,
  useUpdateFormElementMutation,
  useUpdateFormLogicRuleMutation,
  useUpdateLogicConditionMutation,
  AddConditionDocument,
  AddConditionMutation,
  AddConditionMutationVariables,
  DeleteLogicConditionDocument,
  DeleteLogicRuleDocument,
  FormElementFullDetailsFragment,
} from "../../generated/graphql";
import { useCreate, useDelete } from "../../graphqlHookWrappers";
import { collectHeaders, collectQuestion } from "./collectText";

type FE = FormElementFullDetailsFragment;

export default function LogicRuleEditor({
  rules,
  selectedIds,
  formElements,
  form,
}: {
  rules: LogicRuleEditorRuleFragment[];
  formElements: FE[];
  form: Pick<Form, "id">;
  selectedIds: number[];
}) {
  const formElementId = selectedIds[0];
  const formElement = formElements.find((e) => e.id === formElementId)!;
  rules = rules.filter((r) => r.formElementId === formElementId);
  const index = formElements.indexOf(formElement);
  const { t } = useTranslation("admin:surveys");
  const onError = useGlobalErrorHandler();
  let parentFormElementId: number | null = null;
  if (formElement) {
    const parent = formElements.find(
      (f) => f.sketchClass?.form?.id === formElement.formId
    );
    parentFormElementId = parent?.id || null;
  }
  const [initializeRule] = useCreateLogicRuleForSurveyMutation({
    onError,
    optimisticResponse: (data) => ({
      __typename: "Mutation",
      createSurveyJumpRule: {
        __typename: "CreateSurveyJumpRulePayload",
        formLogicRule: {
          __typename: "FormLogicRule",
          id: 9999999,
          position: (rules.slice(-1)[0]?.id || 99) + 1,
          booleanOperator: FormLogicOperator.Or,
          command: FormLogicCommand.Jump,
          jumpToId: data.jumpToId,
          formElementId,
          conditions: [
            {
              __typename: "FormLogicCondition",
              id: 99999999,
              operator: data.operator,
              ruleId: 9999999,
              subjectId: formElementId,
              value: null,
            },
          ],
        },
      },
    }),
    update: (cache, { data }) => {
      if (data?.createSurveyJumpRule?.formLogicRule) {
        const rule = data.createSurveyJumpRule.formLogicRule;
        cache.modify({
          id: cache.identify(form),
          fields: {
            logicRules(existingRefs = [], { readField }) {
              const newRuleRef = cache.writeFragment({
                data: rule,
                fragment: gql`
                  fragment NewRule on FormLogicRule {
                    booleanOperator
                    command
                    id
                    jumpToId
                    position
                    formElementId
                    conditions {
                      id
                      operator
                      value
                      subjectId
                      ruleId
                    }
                  }
                `,
              });
              return [...existingRefs, newRuleRef];
            },
          },
        });
      }
    },
  });
  const [updateFormElement] = useUpdateFormElementMutation({
    onError,
  });

  const [updateRule] = useUpdateFormLogicRuleMutation({
    onError,
    // @ts-ignore
    optimisticResponse: (data) => ({
      __typename: "Mutation",
      updateFormLogicRule: {
        __typename: "UpdateFormLogicRulePayload",
        formLogicRule: {
          __typename: "FormLogicRule",
          ...rules.find((r) => r.id === data.id)!,
          ...data,
        },
      },
    }),
  });

  const [updateCondition] = useUpdateLogicConditionMutation({
    onError,
    // @ts-ignore
    optimisticResponse: (data) => {
      let condition: Partial<FormLogicCondition> | null = null;
      for (const rule of rules) {
        for (const c of rule.conditions || []) {
          if (c.id === data.id) {
            condition = c;
          }
        }
      }
      return {
        __typename: "Mutation",
        updateFormLogicCondition: {
          __typename: "UpdateFormLogicConditionPayload",
          formLogicCondition: {
            ...condition,
            ...data,
          },
        },
      };
    },
  });

  function createRule(operator: FieldRuleOperator) {
    return () => {
      initializeRule({
        variables: {
          formElementId,
          jumpToId: formElements[index + 1].id,
          operator,
        },
      });
    };
  }

  const deleteRule = useDelete(DeleteLogicRuleDocument, true);

  const createCondition = useCreate<
    AddConditionMutation,
    AddConditionMutationVariables
  >(AddConditionDocument, {
    addToLists: (data) => {
      const ruleId = data.createFormLogicCondition!.formLogicCondition!.ruleId!;
      return [
        {
          ref: rules.find((r) => r.id === ruleId)!,
          prop: "conditions",
        },
      ];
    },
    optimisticDefaults: { value: null },
  });

  const deleteCondition = useDelete(DeleteLogicConditionDocument);
  const { confirmDelete } = useDialog();
  if (
    formElement.type?.componentName === "WelcomeMessage" ||
    formElement.type?.componentName === "ThankYou" ||
    formElement.type?.componentName === "SaveScreen"
  ) {
    return (
      <p className="p-2 text-sm text-gray-500">
        <Trans ns="admin:surveys">
          Skip logic cannot be specified for {formElement.type.componentName}{" "}
          elements.
        </Trans>
      </p>
    );
  }

  if (!formElement?.type?.isInput) {
    return (
      // eslint-disable-next-line i18next/no-literal-string
      <div>
        <p className="p-2 text-sm">
          <Trans ns="admin:surveys">
            Survey advances from this questions to...
          </Trans>
        </p>
        <div className="p-2 w-full">
          <FormElementSelect
            mode={FormElementSelectMode.DefaultNext}
            value={formElement.jumpToId!}
            onChange={(value) => {
              updateFormElement({
                variables: {
                  id: formElement.id,
                  jumpToId: value,
                },
                optimisticResponse: {
                  __typename: "Mutation",
                  updateFormElement: {
                    __typename: "UpdateFormElementPayload",
                    formElement: {
                      ...formElements.find((fe) => fe.id === formElement.id)!,
                      jumpToId: value,
                    },
                  },
                },
              });
            }}
            currentFormElementId={formElementId}
            formElements={formElements}
          />
        </div>
      </div>
    );
  }

  if (selectedIds.length > 1) {
    return (
      // eslint-disable-next-line i18next/no-literal-string
      <div>
        <p className="p-2 text-sm text-gray-500">
          <Trans ns="admin:surveys" count={selectedIds.length}>
            Editing {selectedIds.length.toString()} items
          </Trans>
        </p>
        <p className="p-2 text-sm">
          <Trans ns="admin:surveys">
            If no conditions match, survey advances from these questions to...
          </Trans>
        </p>
        <div className="p-2 w-full">
          <FormElementSelect
            mode={FormElementSelectMode.DefaultNext}
            value={formElement.jumpToId!}
            onChange={(value) => {
              for (const id of selectedIds) {
                updateFormElement({
                  variables: {
                    id: id,
                    jumpToId: value,
                  },
                  optimisticResponse: {
                    __typename: "Mutation",
                    updateFormElement: {
                      __typename: "UpdateFormElementPayload",
                      formElement: {
                        ...formElements.find((fe) => fe.id === id)!,
                        jumpToId: value,
                      },
                    },
                  },
                });
              }
            }}
            currentFormElementId={formElementId}
            formElements={formElements}
          />
        </div>
      </div>
    );
  }
  return (
    <div>
      {rules.length > 0 && (
        <div className="p-2 text-sm">
          {rules.map((rule) => {
            return (
              <div key={rule.id} className="p-1 border bg-gray-50 mb-4">
                <h4 className="text-sm p-1 pb-2 flex items-center">
                  <span className="w-full">{t("Skip to")}</span>
                  <button
                    className=""
                    onClick={() => {
                      confirmDelete({
                        message: t(
                          "Are you sure you want to delete this rule?"
                        ),
                        description: t("This action cannot be undone."),
                        onDelete: async () => {
                          await deleteRule(rule);
                        },
                      });
                    }}
                  >
                    <TrashIcon className="w-4 h-4 mx-2 opacity-60" />
                  </button>
                </h4>
                <FormElementSelect
                  mode={FormElementSelectMode.JumpTo}
                  formElements={formElements.filter(
                    (f) => f.formId === formElement.formId
                  )}
                  currentFormElementId={formElementId}
                  value={rule.jumpToId!}
                  onChange={(id) => {
                    updateRule({
                      variables: {
                        id: rule.id,
                        jumpToId: id,
                      },
                    });
                  }}
                  endOfSubformOption={parentFormElementId || undefined}
                />

                <h4 className="text-sm py-1 mt-1">{t("When")}</h4>
                {(rule.conditions || []).map((condition) => {
                  return (
                    <React.Fragment key={condition.id}>
                      <div
                        key={condition.id}
                        className="bg-blue-100 border-black border-opacity-10 text-sm rounded-lg overflow-hidden flex items-center w-full border h-8"
                      >
                        <OperatorSelect
                          className="flex-1 text-xl"
                          value={condition.operator}
                          operators={
                            (formElement.type?.supportedOperators ||
                              []) as FieldRuleOperator[]
                          }
                          onChange={(op) => {
                            updateCondition({
                              variables: {
                                id: condition.id,
                                operator: op,
                              },
                            });
                          }}
                        />
                        {condition.operator !== FieldRuleOperator.IsBlank && (
                          <div className="flex-1 border-l border-blue-800 border-opacity-20">
                            <AdminValueInput
                              componentName={
                                formElements.find(
                                  (f) => f.id === condition.subjectId
                                )?.typeId
                              }
                              componentSettings={
                                formElements.find(
                                  (f) => f.id === condition.subjectId
                                )?.componentSettings
                              }
                              value={condition.value}
                              onChange={(value) => {
                                updateCondition({
                                  variables: {
                                    id: condition.id,
                                    value: value,
                                  },
                                });
                              }}
                            />
                          </div>
                        )}

                        <button
                          className={`h-full ${adminValueInputCommonClassNames.replace(
                            "w-full",
                            ""
                          )}`}
                          onClick={() => {
                            if (
                              global.confirm(
                                rule.conditions!.length > 1
                                  ? t(
                                      "Are you sure you want to delete this condition?"
                                    )
                                  : t(
                                      "Are you sure? This will delete the entire rule."
                                    )
                              )
                            ) {
                              if (rule.conditions!.length > 1) {
                                deleteCondition(condition);
                              } else {
                                deleteRule(rule);
                              }
                            }
                          }}
                        >
                          <TrashIcon className="w-4 h-4 mx-2 opacity-60" />
                        </button>
                      </div>
                    </React.Fragment>
                  );
                })}

                <button
                  className="p-1 mt-2 rounded px-2 bg-blue-50 shadow-sm items-center flex border-black border border-opacity-20"
                  onClick={() => {
                    createCondition({
                      ruleId: rule.id,
                      subjectId: formElement.id,
                      operator: formElement.type!.supportedOperators[0]!,
                    });
                  }}
                >
                  <PlusIcon className="w-3 h-3 inline mr-1" />
                  <Trans ns="admin:surveys">add condition</Trans>
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="p-2">
        {rules.length > 0 && (
          <Button
            label={t("Add another rule")}
            onClick={
              formElement.type?.supportedOperators[0]
                ? createRule(formElement.type?.supportedOperators[0])
                : undefined
            }
          />
        )}
      </div>

      {formElement.type.supportedOperators.length > 0 ? (
        <>
          <p className="p-2 text-sm">
            {rules.length === 0 ? (
              <Trans ns="admin:surveys">
                Survey advances from this question to...
              </Trans>
            ) : (
              <Trans ns="admin:surveys">
                If the above conditions do not match, survey advances to...
              </Trans>
            )}
          </p>
          <div className="p-2 w-full">
            <FormElementSelect
              mode={FormElementSelectMode.DefaultNext}
              value={formElement.jumpToId!}
              onChange={(value) => {
                updateFormElement({
                  variables: {
                    id: formElementId,
                    jumpToId: value,
                  },
                  optimisticResponse: {
                    __typename: "Mutation",
                    updateFormElement: {
                      __typename: "UpdateFormElementPayload",
                      formElement: {
                        ...formElement,
                        jumpToId: value,
                      },
                    },
                  },
                });
              }}
              currentFormElementId={formElementId}
              formElements={formElements.filter(
                (f) => f.formId === formElement.formId
              )}
              endOfSubformOption={parentFormElementId || undefined}
            />
          </div>
          <div className="p-2">
            {rules.length === 0 &&
              formElement.type?.supportedOperators.length > 0 && (
                <Button
                  label={t("Add conditions")}
                  onClick={
                    formElement.type?.supportedOperators[0]
                      ? createRule(formElement.type?.supportedOperators[0])
                      : undefined
                  }
                />
              )}
          </div>
        </>
      ) : (
        <p className="px-2 text-sm text-gray-500">
          <Trans ns="surveys:admin">
            This form element type does not support conditional logic.
          </Trans>
        </p>
      )}
    </div>
  );
}

enum FormElementSelectMode {
  JumpTo,
  SubjectId,
  DefaultNext,
}

function FormElementSelect({
  formElements,
  currentFormElementId,
  value,
  onChange,
  endOfSubformOption,
  mode,
}: {
  value: number;
  onChange: (id: number | null) => void;
  formElements: FE[];
  currentFormElementId: number;
  endOfSubformOption?: number;
  mode: FormElementSelectMode;
}) {
  const currentElement = formElements.find(
    (e) => e.id === currentFormElementId
  )!;
  const { t } = useTranslation("admin:surveys");
  const currentFormElementIndex = formElements.indexOf(currentElement);
  return (
    <select
      className="max-w-full rounded shadow focus:ring-0 focus:outline-none truncate"
      value={value || ""}
      onChange={(e) => {
        const value =
          e.target.value === "next" ? null : parseInt(e.target.value);
        onChange(value);
      }}
    >
      {mode === FormElementSelectMode.DefaultNext && (
        <option value="next">{t("Default, next in list")}</option>
      )}
      {formElements
        .filter(
          (el) =>
            (mode === FormElementSelectMode.SubjectId ||
              el.id !== currentFormElementId) &&
            el.typeId !== "ThankYou"
        )
        .map((el) => (
          <option
            key={el.id}
            value={el.id.toString()}
            disabled={
              ((mode === FormElementSelectMode.DefaultNext ||
                mode === FormElementSelectMode.JumpTo) &&
                formElements.indexOf(el) < currentFormElementIndex) ||
              (mode === FormElementSelectMode.SubjectId &&
                formElements.indexOf(el) > currentFormElementIndex)
            }
          >
            {collectQuestion(el.body) || collectHeaders(el.body)}
          </option>
        ))}
      {endOfSubformOption && (
        <option value={endOfSubformOption}>
          {t("End of spatial attributes")}
        </option>
      )}
    </select>
  );
}

function OperatorSelect({
  value,
  operators,
  onChange,
  className,
}: {
  operators: FieldRuleOperator[];
  value: FieldRuleOperator;
  onChange: (operator: FieldRuleOperator) => void;
  className?: string;
}) {
  return (
    <div className={`${className}`}>
      <select
        className={`${adminValueInputCommonClassNames}`}
        value={value.toString()}
        onChange={(e) => onChange(e.target.value as FieldRuleOperator)}
      >
        {operators.map((op) => (
          <option key={op.toString()} value={op.toString()}>
            {OPERATOR_LABELS[op]}
          </option>
        ))}
      </select>
    </div>
  );
}

export const OPERATOR_LABELS = {
  [FieldRuleOperator.Equal]: "=",
  [FieldRuleOperator.NotEqual]: "!=",
  [FieldRuleOperator.GreaterThan]: ">",
  [FieldRuleOperator.LessThan]: "<",
  [FieldRuleOperator.Contains]: "Contains",
  [FieldRuleOperator.IsBlank]: "Blank",
};

export function AdminValueInput({
  value,
  onChange,
  componentName,
  componentSettings,
}: {
  componentName?: string;
  value: any | null;
  onChange: (value: any) => void;
  componentSettings?: any;
}) {
  const CustomInput = components[componentName || "nope"]?.adminValueInput;
  if (CustomInput) {
    return (
      <CustomInput
        componentSettings={componentSettings}
        onChange={onChange}
        value={value}
      />
    );
  } else {
    return (
      <input
        className={`text-sm text-right ${adminValueInputCommonClassNames} bg-white bg-opacity-50`}
        type="text"
        autoComplete="false"
        spellCheck={false}
        onChange={(e) => {
          const value = e.target.value;
          onChange(value);
        }}
        value={value?.toString()}
      />
    );
  }
}

function FormElementListItem({ formElement }: { formElement: FE }) {
  const icon = components[formElement.typeId].icon || defaultFormElementIcon;
  return (
    <div className="flex items-center">
      <div className="w-5 h-5 rounded m-1 overflow-hidden flex-shrink-0">
        {icon}
      </div>
      <p className="truncate">
        {collectQuestion(formElement.body) || collectHeaders(formElement.body)}
      </p>
    </div>
  );
}
