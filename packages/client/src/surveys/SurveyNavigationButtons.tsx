import {
  ChevronDownIcon,
  ChevronUpIcon,
  TranslateIcon,
} from "@heroicons/react/outline";
import { MouseEventHandler, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { SurveyContext } from "../formElements/FormElement";
import {
  FormElementLayout,
  SurveyAppFormElementFragment,
} from "../generated/graphql";
import { SurveyStyleContext } from "./appearance";
import LanguageSelector from "./LanguageSelector";
import { SurveyPagingState } from "./paging";

interface SurveyNavigationButtonProps {
  canAdvance: boolean;
  onNext: MouseEventHandler<HTMLAnchorElement>;
  onPrev: MouseEventHandler<HTMLAnchorElement>;
  slug: string;
  surveyId: string;
  practice?: string;
  pagingState: SurveyPagingState<SurveyAppFormElementFragment>;
  hidden?: boolean;
}

export default function SurveyNavigationButton({
  pagingState,
  onNext,
  onPrev,
  slug,
  surveyId,
  canAdvance,
  practice,
  hidden,
}: SurveyNavigationButtonProps) {
  const style = useContext(SurveyStyleContext);
  const context = useContext(SurveyContext);
  const { t } = useTranslation("surveys");
  if (hidden) {
    return null;
  }
  return (
    <div
      style={{
        width: "fit-content",
        height: "fit-content",
      }}
      className={`z-20 flex pointer-events-auto ${style.secondaryTextClass} ${
        !pagingState.previousFormElement && "hidden"
      }`}
    >
      {pagingState.previousFormElement && (
        <Link
          title={t("Previous Question")}
          onClick={onPrev}
          to={`/${slug}/surveys/${surveyId}/${pagingState.sortedFormElements.indexOf(
            pagingState.previousFormElement
          )}/${practice ? "practice" : ""}`}
          className={`inline-block border-r shadow border-${style.secondaryTextClass.replace(
            "text-",
            ""
          )} border-opacity-10 opacity-95 hover:opacity-100 p-2 rounded-l `}
          style={{
            background: `linear-gradient(${style.secondaryColor}, ${style.secondaryColor2})`,
          }}
        >
          <ChevronUpIcon className="w-6 h-6" />
        </Link>
      )}
      {(context?.supportedLanguages || []).length > 0 && (
        <LanguageSelector
          button={(onClick) => (
            <button
              className="px-3"
              style={{
                background: `linear-gradient(${style.secondaryColor}, ${style.secondaryColor2})`,
              }}
              onClick={onClick}
            >
              <TranslateIcon className="w-6 h-6" />
            </button>
          )}
        ></LanguageSelector>
      )}
      <Link
        title={t("Next Question")}
        onClick={onNext}
        className={`inline-flex items-center p-2 shadow rounded-r ${
          !canAdvance || pagingState.isLastQuestion
            ? "opacity-50 cursor-default pointer-events-none"
            : "opacity-95 hover:opacity-100"
        }`}
        to={`/${slug}/surveys/${surveyId}/${pagingState.sortedFormElements.indexOf(
          pagingState.nextFormElement!
        )}/${practice ? "practice" : ""}`}
        style={{
          background: `linear-gradient(${style.secondaryColor}, ${style.secondaryColor2})`,
        }}
      >
        <ChevronDownIcon className="w-6 h-6" />
      </Link>
    </div>
  );
}
