import { ExclamationIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import { EMPTY_FEATURE_COLLECTION } from "../../draw/useMapboxGLDraw";
import SurveyButton from "../../surveys/SurveyButton";
import { FormElementBody, FormElementProps } from "../FormElement";
import { FormElementOption } from "../FormElementOptionsInput";
import OptionPicker from "../OptionPicker";
import {
  SpatialAccessPriorityProps,
  STAGES,
  SAPValueType,
} from "./SpatialAccessPriority";

type ChooseSectorsProps = FormElementProps<
  SpatialAccessPriorityProps,
  SAPValueType
> & {
  setSector: (sector: FormElementOption) => void;
  updateValue: (value: SAPValueType) => void;
};

export default function ChooseSectors(props: ChooseSectorsProps) {
  const { t } = useTranslation("surveys");
  return (
    <div className="mb-5">
      <FormElementBody
        required={props.isRequired}
        formElementId={props.id}
        isInput={true}
        body={props.body}
        editable={props.editable}
      />
      {!props.componentSettings.sectorOptions?.length && (
        <div className="rounded p-4 mt-4 bg-yellow-400 bg-opacity-60 text-black text-sm">
          <ExclamationIcon className="w-6 h-6 inline mr-2" />
          <Trans ns="admin:surveys">
            This stage will be skipped if no sector options are specified.
          </Trans>
        </div>
      )}
      <OptionPicker
        options={props.componentSettings.sectorOptions || []}
        multi={true}
        onChange={(sectors) => {
          props.updateValue({
            // @ts-ignore
            collection: props.value?.collection || EMPTY_FEATURE_COLLECTION,
            sectors,
          });
        }}
        value={props.value?.sectors || []}
      />
      <SurveyButton
        className={`transition-opacity duration-300 ${
          !props.value?.sectors?.length ? "opacity-0" : "opacity-100"
        }`}
        disabled={!props.value?.sectors?.length}
        label={t("Next")}
        onClick={() => {
          if (!props.value) {
            throw new Error("No sectors selected");
          }
          const hasAnyFeatures = !!props.value.collection.features.find(
            (f) =>
              (props.value?.sectors || []).indexOf(f.properties.sector) !== -1
          );
          if (hasAnyFeatures) {
            props.onRequestStageChange(STAGES.SECTOR_NAVIGATION);
          } else {
            const nextSector = props.componentSettings.sectorOptions!.find(
              (s) => (s.value || s.label) === props.value!.sectors[0]
            );
            if (!nextSector) {
              throw new Error(
                `Cannot find next sector ${props.value.sectors[0]}`
              );
            }
            props.setSector(nextSector);
            const hasFeatures = !!props.value!.collection.features.find(
              (f) =>
                f.properties.sector === (nextSector.value || nextSector.label)
            );
            if (hasFeatures) {
              props.onRequestStageChange(STAGES.LIST_SHAPES);
            } else {
              props.onRequestStageChange(STAGES.DRAWING_INTRO);
            }
          }
        }}
      />
    </div>
  );
}
