import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import {
  useSketchClassLogicRuleDetailsQuery,
  useSketchingQuery,
} from "../../generated/graphql";
import { useMemo, useState } from "react";
import Button from "../../components/Button";
import Spinner from "../../components/Spinner";
import Skeleton from "../../components/Skeleton";
import { AnimatePresence, motion } from "framer-motion";

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
  const { data, loading } = useSketchClassLogicRuleDetailsQuery({
    variables: {
      sketchClassId: props.sketchClassId,
    },
    fetchPolicy: "network-only",
  });

  const formElement = useMemo(() => {
    return (data?.sketchClass?.form?.formElements || []).find((fe) => {
      return fe.id === props.id;
    });
  }, [data, props.id]);

  const logicRule = (data?.sketchClass?.form?.logicRules || []).find((lr) => {
    return lr.formElementId === props.id;
  });

  const [saving, setSaving] = useState(false);

  const { t } = useTranslation("admin:sketching");

  const [createButtonHovered, setCreateButtonHovered] = useState(false);
  return (
    <Modal
      open={true}
      onRequestClose={props.onRequestClose}
      className=""
      title={t(`Edit Logic Rules`)}
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
        <div className="p-2 bg-gray-50 border rounded-sm h-80">
          {loading && (
            <div className="w-full text-center items-center justify-center">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          )}

          {!logicRule && !loading && (
            <div>
              <div className="flex items-center justify-center p-2">
                <button
                  onMouseEnter={() => setCreateButtonHovered(true)}
                  onMouseLeave={() => setCreateButtonHovered(false)}
                  className="hover:bg-primary-500 hover:shadow-md hover:text-white px-2 py-0.5 bg-gray-300 rounded-full flex items-center gap-1"
                  onClick={() => setSaving(!saving)}
                >
                  <span>{t("Show")}</span>
                  {saving && <Spinner color="white" />}
                </button>
                <span className="mx-2">{t("or")}</span>
                <button
                  onMouseEnter={() => setCreateButtonHovered(true)}
                  onMouseLeave={() => setCreateButtonHovered(false)}
                  className="hover:bg-primary-500 hover:shadow-md hover:text-white px-2 py-0.5 bg-gray-300 rounded-full"
                  onClick={() => setSaving(!saving)}
                >
                  {t("Hide")}
                </button>
              </div>

              <div
                className={`w-1/2 mx-auto text-center bg-white border transition-all p-4 ${
                  createButtonHovered
                    ? "opacity-100 shadow-lg"
                    : "opacity-50 duration-700"
                } group`}
              >
                <h2 className="truncate">{formElement?.generatedLabel}</h2>
              </div>
              <div
                className={`relative flex items-center justify-center mt-8 ${
                  createButtonHovered
                    ? "opacity-100"
                    : "opacity-50 duration-700"
                }`}
              >
                <hr className="w-16 rotate-90 transform border-dotted border-gray-400 z-0" />
                <div className="absolute w-7 h-7 border bg-white rotate-45 transform"></div>
                <div className="absolute z-10">{t("if")}</div>
              </div>
              <div
                className={`mx-auto w-1/2 text-center bg-white bg-opacity-20 border transition-all p-2 text-sm text-gray-500 mt-8 ${
                  createButtonHovered
                    ? "opacity-100 duration-500 shadow-sm"
                    : "opacity-0 duration-700"
                }`}
              >
                {t("condition...")}
              </div>
            </div>
          )}
        </div>
        {/* <div className="py-2">
          <Button label={t("Add Logic Rule")} primary />
        </div> */}
      </div>
    </Modal>
  );
}
