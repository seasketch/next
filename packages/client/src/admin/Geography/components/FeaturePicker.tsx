import { Trans, useTranslation } from "react-i18next";
import MultiSelect from "../../users/GroupMultiSelect";
import Button from "../../../components/Button";
import Warning from "../../../components/Warning";
import { FeatureChoice } from "../hooks/useFeatureChoices";
import { createPortal } from "react-dom";

export type FeaturePickerProps = {
  title: string;
  description: string;
  choices: FeatureChoice[];
  selectedFeatures: number[];
  onSelectionChange: (selectedIds: number[]) => void;
  onRequestClose: () => void;
  onRequestSubmit: () => void;
  loading?: boolean;
  error?: Error;
  saving?: boolean;
  onRequestToggleSidebar: (show: boolean) => void;
};

export default function FeaturePicker({
  title,
  description,
  choices,
  selectedFeatures,
  onSelectionChange,
  onRequestClose,
  onRequestSubmit,
  loading,
  error,
  saving,
  onRequestToggleSidebar,
}: FeaturePickerProps) {
  const { t } = useTranslation("admin:geography");

  return (
    <div className="absolute flex justify-center items-center w-full">
      <div className="w-144 bg-white p-4 rounded-b-md shadow-md">
        <MultiSelect
          filterOption={(option, rawInput) => {
            const input = rawInput.toLowerCase();
            return (
              option.label.toLowerCase().includes(input) ||
              option.value.toString().includes(input)
            );
          }}
          title={title}
          description={description}
          groups={choices}
          value={selectedFeatures.map((id) => {
            const match = choices.find((choice) => choice.value === id);
            if (!match) {
              throw new Error("Feature not found");
            }
            return { value: match.value, label: match.label };
          })}
          onChange={(selected) => {
            onSelectionChange(selected.map((s) => s.value));
          }}
          loading={loading}
        />
        {error && <Warning level="error">{error.message}</Warning>}
        <div className="space-x-2 mt-4">
          <Button
            label={t("Cancel")}
            disabled={saving}
            onClick={() => {
              console.log("onRequestClose");
              onRequestClose();
            }}
          />
          <Button
            label={t("Continue")}
            primary
            loading={saving}
            onClick={onRequestSubmit}
            disabled={selectedFeatures.length === 0 || saving}
          />
        </div>
      </div>
    </div>
  );
}
