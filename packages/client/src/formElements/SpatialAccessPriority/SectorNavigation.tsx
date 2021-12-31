import { CheckIcon } from "@heroicons/react/outline";
import { colord } from "colord";
import { useContext } from "react";
import { Trans, useTranslation } from "react-i18next";
import { SurveyStyleContext } from "../../surveys/appearance";
import SurveyButton from "../../surveys/SurveyButton";
import { FormElementBody, FormElementProps } from "../FormElement";
import { FormElementOption } from "../FormElementOptionsInput";
import SpatialAccessPriority, {
  SAPValueType,
  SpatialAccessPriorityProps,
  STAGES,
} from "./SpatialAccessPriority";

type SectorNavigationProps = FormElementProps<
  SpatialAccessPriorityProps,
  SAPValueType
> & {
  setSector: (sector: FormElementOption) => void;
};

export default function SectorNavigation(props: SectorNavigationProps) {
  const style = useContext(SurveyStyleContext);
  const { t } = useTranslation("surveys");
  const nextSector = (props.componentSettings.sectorOptions || []).find(
    (sector) => {
      return (
        (props.value?.collection.features || []).find(
          (f) => f.properties.sector === (sector.value || sector.label)
        ) === undefined
      );
    }
  );
  return (
    <>
      <FormElementBody
        componentSettingName={"navBody"}
        componentSettings={props.componentSettings}
        required={false}
        formElementId={props.id}
        isInput={false}
        body={
          props.componentSettings.navBody ||
          SpatialAccessPriority.defaultComponentSettings?.navBody
        }
        editable={props.editable}
      />
      <div className="space-y-2 py-4">
        {(props.componentSettings.sectorOptions || [])
          .filter(
            (s) =>
              (props.value?.sectors || []).indexOf(s.value || s.label) !== -1
          )
          .map((sector) => {
            const numShapes = (props.value?.collection.features || []).filter(
              (f) => f.properties.sector === (sector.value || sector.label)
            ).length;
            const hasValue = numShapes > 0;
            return (
              <button
                className={`border rounded transition-all duration-200 active:scale-105 transform flex items-center ${
                  style.isDark ? "bg-white" : "bg-black"
                } bg-opacity-5 hover:bg-opacity-10 hover:bg-white px-4 py-2 pr-6 text-white w-full text-left ${
                  hasValue ? style.secondaryTextClass : style.textClass
                }`}
                onClick={() => {
                  props.onRequestStageChange(
                    hasValue ? STAGES.LIST_SHAPES : STAGES.DRAWING_INTRO
                  );
                  props.setSector(sector);
                }}
                style={
                  hasValue
                    ? {
                        background: `linear-gradient(${style.secondaryColor}, ${style.secondaryColor2})`,
                      }
                    : {
                        background: colord(style.backgroundColor)
                          .alpha(0.8)
                          .toHex(),
                      }
                }
              >
                <div className="flex items-center">
                  {hasValue ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : (
                    <div
                      className={`inline-block border rounded border-opacity-50 w-5 h-5`}
                    >
                      &nbsp;
                    </div>
                  )}
                </div>
                <div className="flex-1 items-center px-5 truncate">
                  {sector.label}
                </div>
                <div className="flex items-center">
                  {hasValue && (
                    <Trans ns="surveys" count={numShapes}>
                      {numShapes.toString()} areas
                    </Trans>
                  )}
                </div>
              </button>
            );
          })}
      </div>
      <div className="space-x-4 mt-2">
        {nextSector && (
          <SurveyButton
            onClick={() => {
              props.setSector(nextSector);
              props.onRequestStageChange(STAGES.DRAWING_INTRO);
            }}
            label={<Trans ns="surveys">Next sector</Trans>}
          />
        )}
        {!nextSector && (
          <SurveyButton
            onClick={props.onRequestNext}
            label={t("Next Question")}
          />
        )}
        <button
          className="underline"
          onClick={() => {
            props.onRequestStageChange(STAGES.CHOOSE_SECTORS);
          }}
        >
          <Trans ns="surveys">Change choices</Trans>
        </button>
      </div>
    </>
  );
}
