import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import {
  useSketchClassLogicRuleDetailsQuery,
  useCreateVisibilityRuleMutation,
  LogicRuleDetailsFragment,
  SketchingDetailsFragment,
  LogicRuleConditionDetailsFragment,
  LogicRuleEditorFormDetailsFragment,
  LogicRuleEditorFormElementDetailsFragment,
  FieldRuleOperator,
  useUpdateVisibilityRuleMutation,
  useUpdateVisibilityConditionMutation,
  useDeleteVisibilityRuleMutation,
  useAddConditionMutation,
  useDeleteVisibilityRuleConditionMutation,
  FormLogicOperator,
} from "../../generated/graphql";
import { Fragment, useEffect, useMemo, useState } from "react";
import Skeleton from "../../components/Skeleton";
import { OPERATOR_LABELS } from "../surveys/LogicRuleEditor";
import { AdminValueInput } from "../surveys/LogicRuleEditor";
import { TrashIcon } from "@heroicons/react/outline";
import { gql } from "@apollo/client";
import { MutationStateIndicator } from "../../components/MutationStateIndicator";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";

interface SketchAttributesFormLogicRulesModalProps {
  /** The id of the FormElement whose visibility is controlled by the rules */
  id: number;
  sketchClassId: number;
  onRequestClose: () => void;
}

/**
 * Modal for editing FormLogicRules that control visibility of a single FormElement.
 * This enables admins to specify for example a FormElement with freeform text input
 * which would only be visible if the user selected an "Other" option from a dropdown.
 */
export default function SketchAttributesFormLogicRulesModal(
  props: SketchAttributesFormLogicRulesModalProps
) {
  const onError = useGlobalErrorHandler();
  const { data, loading } = useSketchClassLogicRuleDetailsQuery({
    variables: {
      sketchClassId: props.sketchClassId,
    },
    fetchPolicy: "cache-and-network",
  });

  const logicRule = (data?.sketchClass?.form?.logicRules || []).find((lr) => {
    return lr.formElementId === props.id;
  });

  const [deleteRule, deleteState] = useDeleteVisibilityRuleMutation({
    onError,
    update: (cache, results) => {
      const id = results.data?.deleteFormLogicRule?.formLogicRule?.id;
      if (id) {
        // remove form logic rule from cache
        cache.evict({
          // eslint-disable-next-line i18next/no-literal-string
          id: `FormLogicRule:${id}`,
        });
      }
    },
  });

  const { t } = useTranslation("admin:sketching");

  const [createMutation, createMutationState] = useCreateVisibilityRuleMutation(
    {
      onError,
      variables: {
        formElementId: props.id,
      },
      update: (cache, results) => {
        // update the cache with the new logic rule, assigning new rule to the
        // matching form element in the apollo cache.
        const newLogicRule =
          results.data?.createVisibilityLogicRule?.formLogicRule;
        if (newLogicRule && data?.sketchClass?.form) {
          cache.modify({
            id: cache.identify(data.sketchClass.form),
            fields: {
              logicRules(existingLogicRuleRefs, { readField }) {
                const newRef = cache.writeFragment({
                  data: newLogicRule,
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
                return [newRef];
              },
            },
          });
        }
      },
    }
  );

  const [ruleMutationState, setRuleMutationState] = useState<
    "NONE" | "SAVING" | "SAVED"
  >("NONE");

  const mutationState = useMemo(() => {
    if (
      createMutationState.loading ||
      deleteState.loading ||
      ruleMutationState === "SAVING"
    ) {
      return "SAVING";
    } else if (
      createMutationState.called ||
      deleteState.called ||
      ruleMutationState === "SAVED"
    ) {
      return "SAVED";
    } else {
      return "NONE";
    }
  }, [createMutationState, deleteState, ruleMutationState]);

  return (
    <Modal
      open={true}
      onRequestClose={props.onRequestClose}
      className=""
      title={
        <div className="flex">
          <div>{t(`Edit Logic Rules`)}</div>
          <div className="relative">
            <MutationStateIndicator state={mutationState} />
          </div>
        </div>
      }
      footer={[
        {
          label: t("Close"),
          onClick: props.onRequestClose,
        },
      ]}
    >
      <div className="">
        <p className="text-sm text-gray-500 mb-2">
          <Trans ns="admin:sketching">
            Logic rules control the visibility of this form element based on the
            values of other form elements. For example, you could make a text
            input visible only if the user selects "Other" from a dropdown so
            they can specify more detail.
          </Trans>
        </p>
        <div className="p-2 bg-gray-50 border rounded-sm h-96 overflow-y-auto relative">
          {!loading && logicRule && (
            <button
              onClick={() =>
                deleteRule({
                  variables: {
                    id: logicRule.id,
                  },
                })
              }
              className="absolute top-2 right-2 text-sm bg-gray-200 flex items-center gap-1 rounded-full px-1.5 py-0.5 hover:bg-gray-300 transition-all"
            >
              <TrashIcon className="w-4 h-4" />
              {t("Clear rule")}
            </button>
          )}
          {loading && (
            <div className="w-full text-center items-center justify-center">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          )}
          {!loading && !logicRule && (
            <div className="flex items-center justify-center h-1/2">
              <p className="text-center w-full">
                <Trans ns="admin:sketching">No logic rules configured.</Trans>
                <button
                  disabled={createMutationState.loading}
                  onClick={() => createMutation()}
                  className={` ml-1 ${
                    createMutationState.loading
                      ? "text-gray-500"
                      : "text-primary-500 underline"
                  }`}
                >
                  {t("Create one")}
                </button>
              </p>
            </div>
          )}

          {!loading && logicRule && data?.sketchClass?.form && (
            <LogicRuleEditor
              onMutationStateChange={setRuleMutationState}
              form={data.sketchClass.form}
              rule={logicRule}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

function LogicRuleEditor({
  form,
  onMutationStateChange,
  rule,
}: {
  rule: LogicRuleDetailsFragment;
  form: LogicRuleEditorFormDetailsFragment;
  onMutationStateChange?: (state: "SAVED" | "SAVING" | "NONE") => void;
}) {
  const onError = useGlobalErrorHandler();
  const [mutate, mutationState] = useUpdateVisibilityRuleMutation({
    onError,
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateFormLogicRule: {
          __typename: "UpdateFormLogicRulePayload",
          formLogicRule: {
            __typename: "FormLogicRule",
            id: data.id,
            command: data.command || rule.command!,
            booleanOperator: data.booleanOperator || rule.booleanOperator!,
          },
        },
      };
    },
  });

  const { t } = useTranslation("admin:sketching");

  const [addCondition, addConditionState] = useAddConditionMutation({
    onError,
    update: (cache, result) => {
      const condition =
        result.data?.createFormLogicCondition?.formLogicCondition;
      if (condition && form.logicRules?.length) {
        cache.modify({
          id: cache.identify(form.logicRules[0]),
          fields: {
            conditions(existingConditions = []) {
              const newRef = cache.writeFragment({
                data: condition,
                fragment: gql`
                  fragment NewCondition on FormLogicCondition {
                    id
                  }
                `,
              });
              return [...existingConditions, newRef];
            },
          },
        });
      }
    },
  });

  const [conditionMutationState, setConditionMutationState] = useState<
    "NONE" | "SAVING" | "SAVED"
  >("NONE");

  const ruleMutationState = useMemo(() => {
    if (
      mutationState.loading ||
      addConditionState.loading ||
      conditionMutationState === "SAVING"
    ) {
      return "SAVING";
    } else if (
      mutationState.called ||
      addConditionState.called ||
      conditionMutationState === "SAVED"
    ) {
      return "SAVED";
    } else {
      return "NONE";
    }
  }, [addConditionState, mutationState, conditionMutationState]);

  useEffect(() => {
    onMutationStateChange?.(ruleMutationState);
  }, [ruleMutationState, onMutationStateChange]);

  return (
    <div>
      <div className="flex items-center justify-center p-2">
        <select
          value={rule.command}
          className="bg-white rounded border border-gray-300 relative z-10"
          onChange={(e) => {
            mutate({
              variables: {
                id: rule.id,
                command: e.target.value as any,
              },
            });
          }}
        >
          <option value="SHOW">{t("Show")}</option>
          <option value="HIDE">{t("Hide")}</option>
        </select>
      </div>
      <hr className="w-16 rotate-90 transform border-dotted border-gray-400 z-auto mx-auto" />
      <div
        className={`w-auto max-w-sm mx-auto text-center bg-white border p-4 opacity-100 shadow-lg z-10 relative`}
      >
        <h2 className="truncate">
          {(form.formElements || []).find((f) => f.id === rule.formElementId)
            ?.generatedLabel || ""}
        </h2>
      </div>
      <div
        className={`relative flex items-center justify-center mt-8 opacity-100`}
      >
        <hr className="w-16 rotate-90 transform border-dotted border-gray-400 z-0" />
        <div className="absolute w-7 h-7 border bg-white rotate-45 transform"></div>
        <div className="absolute z-10">{t("if")}</div>
      </div>
      {(rule.conditions || []).map((condition, index) => (
        <Fragment key={condition.id}>
          <LogicRuleConditionEditor
            condition={condition}
            rule={rule}
            formElements={form.formElements || []}
            onMutationStateChange={setConditionMutationState}
          />
          {index < (rule.conditions || []).length - 1 && (
            <div
              className={`relative flex items-center justify-center mt-8 opacity-100`}
            >
              <hr className="w-16 rotate-90 transform border-dotted border-gray-400 z-0" />
              <div className="absolute w-7 h-7 border bg-white rotate-45 transform"></div>
              <select
                onChange={(e) => {
                  mutate({
                    variables: {
                      id: rule.id,
                      booleanOperator: e.target.value as any,
                    },
                  });
                }}
                className="bg-white rounded border border-gray-300 z-10 absolute"
                value={rule.booleanOperator}
              >
                <option value={FormLogicOperator.And}>{t("AND")}</option>
                <option value={FormLogicOperator.Or}>{t("OR")}</option>
              </select>
            </div>
          )}
        </Fragment>
      ))}
      <button
        onClick={() => {
          const validSubjects = (form.formElements || []).filter((f) => {
            if (f.id === rule.formElementId) {
              return false;
            }
            if (!f.type?.isInput) {
              return false;
            }
            if (
              (f.type?.supportedOperators || []).filter(
                (o) => o !== FieldRuleOperator.IsBlank
              ).length === 0
            ) {
              return false;
            }
            return true;
          });
          if (validSubjects.length === 0) {
            throw new Error("No valid subjects");
          }

          // Assign a new subject.
          // Prefer a valid subject that hasn't been used in a condition yet.
          // Otherwise, just use the first valid subject.
          let subject = validSubjects.find(
            (s) =>
              !rule.conditions?.find((c) => c.subjectId === s.id) &&
              s.id !== rule.formElementId
          );
          subject = subject || validSubjects[0];
          if (!subject) {
            throw new Error("No valid subject");
          }
          const { operator, value } = getDefaultsForSubject(subject);
          addCondition({
            variables: {
              ruleId: rule.id,
              subjectId: subject.id,
              operator,
              value,
            },
          });
        }}
        className="block mx-auto bg-gray-400  rounded-full px-2 py-0.5 text-sm mt-4 opacity-30 text-black hover:opacity-100 transition-all hover:text-white hover:bg-primary-500"
      >
        {t("Add another condition")}
      </button>
    </div>
  );
}

function LogicRuleConditionEditor({
  condition,
  rule,
  formElements,
  onMutationStateChange,
}: {
  condition: LogicRuleConditionDetailsFragment;
  rule: LogicRuleDetailsFragment;
  formElements: LogicRuleEditorFormElementDetailsFragment[];
  onMutationStateChange?: (state: "NONE" | "SAVING" | "SAVED") => void;
}) {
  const subject = formElements.find((f) => f.id === condition.subjectId);
  const subjectType = subject?.type;
  const onError = useGlobalErrorHandler();
  const [deleteCondition] = useDeleteVisibilityRuleConditionMutation({
    update: (cache, result) => {
      const condition =
        result.data?.deleteFormLogicCondition?.formLogicCondition;
      if (condition && rule.conditions?.length) {
        cache.evict({
          // eslint-disable-next-line i18next/no-literal-string
          id: cache.identify(condition),
        });
      }
    },
    onError,
  });
  const [mutate, mutationState] = useUpdateVisibilityConditionMutation({
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateFormLogicCondition: {
          __typename: "UpdateFormLogicConditionPayload",
          formLogicCondition: {
            __typename: "FormLogicCondition",
            id: condition.id,
            operator: data.operator || condition.operator!,
            value: data.value || condition.value!,
            subjectId: data.subjectId || condition.subjectId!,
          },
        },
      };
    },
    onError,
  });
  const validSubjects = useMemo(() => {
    return formElements.filter((f) => {
      if (f.id === rule.formElementId) {
        return false;
      }
      if (!f.type?.isInput) {
        return false;
      }
      if (
        (f.type?.supportedOperators || []).filter(
          (o) => o !== FieldRuleOperator.IsBlank
        ).length === 0
      ) {
        return false;
      }
      return true;
    });
  }, [formElements, rule.formElementId]);

  const conditionMutationState = useMemo(() => {
    if (mutationState.loading) {
      return "SAVING";
    } else if (mutationState.called) {
      return "SAVED";
    } else {
      return "NONE";
    }
  }, [mutationState]);

  useEffect(() => {
    if (onMutationStateChange) {
      onMutationStateChange(conditionMutationState);
    }
  }, [conditionMutationState, onMutationStateChange]);

  if (!subject) {
    return (
      <Trans ns="admin:sketching">
        Subject of LogicRule condition not found!
      </Trans>
    );
  } else if (!subjectType) {
    return (
      <Trans ns="admin:sketching">
        Subject of LogicRule condition has no type!
      </Trans>
    );
  }
  return (
    <div
      className={`relative mx-auto max-w-sm flex flex-col items-center text-center bg-white border p-2 text-sm text-gray-500 mt-8 opacity-100 duration-500 shadow-sm`}
    >
      {(rule.conditions || []).length > 1 && (
        <button
          onClick={() =>
            deleteCondition({
              variables: {
                id: condition.id,
              },
            })
          }
          className="absolute top-5 right-2"
        >
          <TrashIcon className="w-4 h-4 text-gray-500" />
        </button>
      )}
      <select
        value={condition.subjectId}
        style={{
          width:
            (rule?.conditions || []).length > 1 ? "calc(100% - 1.5rem" : "100%",
        }}
        className={`border-none bg-transparent truncate text-center pl-9`}
        onChange={(e) => {
          const newSubject = formElements.find(
            (f) => f.id === parseInt(e.target.value)
          );
          if (!newSubject) {
            throw new Error("Subject not found");
          }
          const { operator, value } = getDefaultsForSubject(newSubject);
          mutate({
            variables: {
              id: condition.id,
              subjectId: parseInt(e.target.value),
              operator,
              value,
            },
          });
        }}
      >
        {validSubjects.map((subject) => (
          <option key={subject.id} value={subject.id!}>
            {subject.generatedLabel}
          </option>
        ))}
      </select>
      <div className="flex w-full bg-blue-100 rounded border border-blue-900 border-opacity-20">
        <select
          value={condition.operator}
          className="border-none bg-transparent text-center"
          onChange={(e) => {
            mutate({
              variables: {
                id: condition.id,
                operator: e.target.value as any,
              },
            });
          }}
        >
          {(subjectType.supportedOperators || []).map((operator) => (
            <option key={operator} value={operator!}>
              {OPERATOR_LABELS[operator!]}
            </option>
          ))}
        </select>
        <AdminValueInput
          value={condition.value}
          componentName={subject.typeId}
          componentSettings={subject.componentSettings}
          onChange={(value) => {
            mutate({
              variables: {
                id: condition.id,
                value: value,
              },
            });
          }}
        />
      </div>
    </div>
  );
}

function getDefaultsForSubject(
  subject: LogicRuleEditorFormElementDetailsFragment
) {
  // Pick the first operator that is supported by the new subject
  const newOperator = subject.type?.supportedOperators?.[0];
  if (!newOperator) {
    throw new Error("No operator found");
  }
  // Pick the first value that is supported by the new subject
  let newValue: any = null;
  const { min, max, defaultValue, options } = subject.componentSettings;
  if (options && options.length) {
    newValue = options[0].value || options[0].label;
  } else if (max) {
    newValue = max;
  } else if (min) {
    newValue = min;
  } else if (defaultValue) {
    newValue = defaultValue;
  }
  return {
    operator: newOperator,
    value: newValue,
  };
}
