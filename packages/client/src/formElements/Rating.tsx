import { StarIcon } from "@heroicons/react/solid";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import EditableResponseCell, {
  CellEditorComponent,
} from "../admin/surveys/EditableResponseCell";
import {
  adminValueInputCommonClassNames,
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";

export type RatingProps = {
  /* More symbols make be added at some point */
  symbol?: "star";
  /* Default 5 stars */
  max?: number;
};

const Rating: FormElementComponent<RatingProps, number> = (props) => {
  const { t } = useTranslation("surveys");
  const stars = Array.from(Array(props.componentSettings.max || 5).keys()).map(
    (i) => i + 1
  );
  const [state, setState] = useState({
    hovered: 0,
    selected: props.value || 0,
  });

  useEffect(() => {
    setState((prev) => ({ ...prev, selected: props.value || 0 }));
  }, [props.value]);

  useEffect(() => {
    if (props.isRequired && props.value === undefined) {
      props.onChange(props.value, true);
    }
  }, []);

  return (
    <>
      <FormElementBody
        formElementId={props.id}
        isInput={true}
        body={props.body}
        required={props.isRequired}
        editable={props.editable}
        alternateLanguageSettings={props.alternateLanguageSettings}
      />
      <div className="py-4 pb-6 space-x-1 rtl:space-x-reverse">
        {stars.map((star) => (
          <button
            key={star}
            onMouseOver={() => setState((prev) => ({ ...prev, hovered: star }))}
            onMouseOut={() => setState((prev) => ({ ...prev, hovered: 0 }))}
            onClick={() => {
              props.onChange(star, false);
              setState((prev) => ({ ...prev, selected: star }));
            }}
            className="inline-block"
            aria-label={`${star} stars`}
            title={`${star} stars`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 transform hover:scale-125 active:scale-150 transition-all cursor-pointer select-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <defs>
                <linearGradient id="selected" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#ffc200" />
                  <stop offset="95%" stopColor="#dd8c00" />
                </linearGradient>
              </defs>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                stroke={
                  props.isRequired &&
                  props.submissionAttempted &&
                  props.value === undefined
                    ? "#bb0000"
                    : state.selected >= star
                    ? "#ffc200"
                    : state.hovered >= star
                    ? "rgba(255, 255, 255, 0.5)"
                    : "currentColor"
                }
                strokeOpacity={state.selected >= star ? 1 : 0.5}
                fill={
                  state.selected >= star
                    ? "url(#selected)"
                    : state.hovered >= star
                    ? "rgba(255, 255, 255, 0.5)"
                    : "none"
                }
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </button>
        ))}
      </div>
      {/* <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return <></>;
        }}
      /> */}
    </>
  );
};

Rating.label = <Trans ns="admin:surveys">Rating</Trans>;
Rating.description = <Trans ns="admin:surveys">Numeric rating</Trans>;
Rating.defaultBody = questionBodyFromMarkdown(`
# 
`);

Rating.icon = () => (
  <div className="bg-yellow-200 w-full h-full font-bold text-center flex justify-center items-center  italic text-white">
    <StarIcon className="w-2/3 text-yellow-600" />
  </div>
);

Rating.adminValueInput = function ({
  value,
  onChange,
  componentSettings,
}: {
  value: any;
  onChange: (value: any) => void;
  componentSettings: RatingProps;
}) {
  const stars = Array.from(Array(componentSettings.max || 5).keys()).map(
    (i) => i + 1
  );
  return (
    <select
      className={`bg-transparent border-none text-center w-full ${adminValueInputCommonClassNames}`}
      value={value || "NULL"}
      onChange={(e) => onChange(parseInt(e.target.value))}
    >
      {value === null && <option value="NULL"> </option>}
      {stars.map((star) => (
        <option key={star} value={star}>
          {star}
        </option>
      ))}
    </select>
  );
};

Rating.ResponseGridCell = function ({
  value,
  componentSettings,
  elementId,
  updateValue,
}) {
  const stars = Array.from(Array(componentSettings.max || 5).keys()).map(
    (i) => i + 1
  );

  value = value || 0;
  return (
    <EditableResponseCell
      elementId={elementId}
      value={value}
      updateValue={updateValue}
      editor={RatingCellEditor}
      componentSettings={componentSettings}
    >
      <div className="space-x-1 rtl:space-x-reverse flex justify-left">
        {stars.map((star) => (
          <div
            key={star}
            className="inline-block"
            aria-label={`${star} stars`}
            title={`${star} stars`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 transform transition-all select-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <defs>
                <linearGradient id="selected" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#ffc200" />
                  <stop offset="95%" stopColor="#dd8c00" />
                </linearGradient>
              </defs>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                stroke={value! >= star ? "#ffc200" : "currentColor"}
                strokeOpacity={value! >= star ? 1 : 0.5}
                fill={value! >= star ? "url(#selected)" : "none"}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </div>
        ))}
      </div>
    </EditableResponseCell>
  );
};

export const RatingCellEditor: CellEditorComponent<
  number | undefined | null,
  RatingProps
> = ({
  value,
  disabled,
  onChange,
  onRequestSave,
  onRequestCancel,
  componentSettings,
}) => {
  const [val, setVal] = useState(value);

  useEffect(() => {
    onChange(val);
  }, [val]);

  const stars = Array.from(Array(componentSettings.max || 5).keys()).map(
    (i) => i + 1
  );

  return (
    <select
      onChange={(e) => setVal(parseInt(e.target.value))}
      value={val || ""}
      className="p-0 px-1 rounded  text-sm w-full"
    >
      {stars.map((value, index) => {
        return (
          <option value={(index + 1).toString()}>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            {index + 1} {"stars"}
          </option>
        );
      })}
    </select>
  );
};

export default Rating;
