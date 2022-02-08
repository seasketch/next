/* eslint-disable i18next/no-literal-string */
import { ComboBoxProps, ComboBoxValue } from "./ComboBox";
import { ConsentProps, ConsentValue } from "./Consent";
import { MultipleChoiceProps, MultipleChoiceValue } from "./MultipleChoice";
import { NameProps, NameType } from "./Name";
import { MatrixProps, MatrixValue } from "./Matrix";
import {
  SAPValueType,
  SpatialAccessPriorityProps,
} from "./SpatialAccessPriority/SpatialAccessPriority";
import {
  FormElementDetailsFragment,
  SurveyResponse,
} from "../generated/graphql";
import { sortFormElements } from "./sortFormElements";
import { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
// import { ExportRow } from "./ExportUtils.d.ts";

export function getAnswers(
  componentName: string,
  exportId: string,
  componentSettings: any,
  answer: any
) {
  if (componentName in components) {
    return components[componentName].getAnswers(
      componentSettings,
      exportId,
      answer
    );
  } else {
    return { [exportId]: answer };
  }
}

type ExportRow = { [key: string]: string | boolean | number | null } & {
  id: number;
  survey_id: number;
  created_at_utc: string;
  updated_at_utc: string | null;
  is_practice: boolean;
  is_duplicate_ip: boolean;
  is_logged_in: boolean;
  account_email: string | null;
};

type FormElement = Pick<
  FormElementDetailsFragment,
  "typeId" | "componentSettings" | "exportId" | "position" | "id" | "isInput"
>;

export function getDataForExport(
  responses: Pick<
    SurveyResponse,
    | "id"
    | "surveyId"
    | "createdAt"
    | "updatedAt"
    | "isPractice"
    | "isDuplicateIp"
    | "userId"
    | "data"
    | "accountEmail"
  >[],
  formElements: FormElement[]
): { rows: ExportRow[]; columns: string[] } {
  const sortedElements = sortFormElements(formElements);
  const rows: ExportRow[] = [];
  const columns = [
    "id",
    "survey_id",
    "created_at_utc",
    "updated_at_utc",
    "is_practice",
    "is_duplicate_ip",
    "is_logged_in",
    "account_email",
  ];
  for (const element of sortedElements) {
    if (element.isInput) {
      if (element.typeId in components) {
        columns.push(
          ...components[element.typeId].getColumns(
            element.componentSettings,
            element.exportId!
          )
        );
      } else {
        columns.push(element.exportId!);
      }
    }
  }
  for (const response of responses) {
    // meta columns
    const row: ExportRow = {
      id: response.id,
      survey_id: response.surveyId,
      created_at_utc: new Date(response.createdAt).toISOString(),
      is_practice: response.isPractice,
      updated_at_utc: response.updatedAt
        ? new Date(response.updatedAt).toISOString()
        : null,
      is_duplicate_ip: response.isDuplicateIp,
      is_logged_in: !!response.userId,
      account_email: response.accountEmail || null,
    };
    // answer data
    const answers = getAnswersAsProperties(sortedElements, response.data);
    rows.push({ ...row, ...answers });
  }
  return { rows, columns };
}

function getAnswersAsProperties(
  sortedElements: FormElement[],
  data: { [elementId: number]: any }
) {
  const answers: { [columnName: string]: number | string | null } = {};
  for (const element of sortedElements) {
    const answer = data[element.id];
    if (answer !== undefined) {
      const columnData = getAnswers(
        element.typeId,
        element.exportId!,
        element.componentSettings,
        answer
      );
      for (const col in columnData) {
        answers[col] = columnData[col];
      }
    }
  }
  return answers;
}

export function normalizeSpatialProperties(
  surveyId: number,
  collection: FeatureCollection<
    Geometry,
    { [key: string]: any } & { response_id: number }
  >,
  formElements: FormElement[]
) {
  const sortedElements = sortFormElements(formElements);
  for (const feature of collection.features) {
    feature.properties = {
      survey_id: surveyId,
      response_id: feature.properties.response_id,
      ...getAnswersAsProperties(sortedElements, feature.properties),
      ...(feature.properties.area_sq_meters
        ? { area_sq_meters: feature.properties.area_sq_meters }
        : {}),
    };
  }
  return collection;
}

type ColumnsFunction<T = any> = (
  componentSettings: T,
  exportId: string
) => string[];
type AnswersFunction<T = any, A = any> = (
  componentSettings: T,
  exportId: string,
  answer: A
) => { [column: string]: any };

let components: {
  [componentName: string]: {
    getColumns: ColumnsFunction;
    getAnswers: AnswersFunction;
  };
} = {};

function registerComponent<ComponentSettingsType, AnswersType>(
  componentName: string,
  getColumns: ColumnsFunction<ComponentSettingsType>,
  getAnswers: AnswersFunction<ComponentSettingsType, AnswersType>
) {
  components[componentName] = {
    getColumns,
    getAnswers,
  };
}

registerComponent<NameProps, NameType>(
  "Name",
  (componentSettings, exportId) => {
    return [exportId, `is_facilitated`, `facilitator_name`];
  },
  (settings, exportId, answer) => {
    return {
      [exportId]: answer.name,
      is_facilitated: !!(answer.facilitator && answer.facilitator.length > 0),
      facilitator_name: answer.facilitator,
    };
  }
);

registerComponent<ConsentProps, ConsentValue>(
  "Consent",
  (componentSettings, exportId) => {
    return [exportId, `${exportId}_doc_version`, `${exportId}_doc_clicked`];
  },
  (settings, exportId, answer) => {
    return {
      [exportId]: !!answer.consented,
      [`${exportId}_doc_version`]: answer.docVersion,
      [`${exportId}_doc_clicked`]: !!answer.clickedDoc,
    };
  }
);

registerComponent<MultipleChoiceProps, MultipleChoiceValue>(
  "MultipleChoice",
  (componentSettings, exportId) => {
    return [exportId];
  },
  (settings, exportId, answer) => {
    return {
      [exportId]: settings.multipleSelect
        ? answer
        : Array.isArray(answer)
        ? answer[0]
        : undefined,
    };
  }
);

registerComponent<ComboBoxProps, ComboBoxValue>(
  "ComboBox",
  (componentSettings, exportId) => {
    return [exportId];
  },
  (settings, exportId, answer) => {
    return {
      [exportId]: Array.isArray(answer) ? answer[0] : answer || undefined,
    };
  }
);

registerComponent<MatrixProps, MatrixValue>(
  "Matrix",
  (componentSettings, exportId) => {
    return (componentSettings.rows || []).map(
      (option) => `${exportId}_${option.value || option.label}`
    );
  },
  (settings, exportId, answer) => {
    return (settings.rows || []).reduce((prev, option) => {
      prev[`${exportId}_${option.value || option.label}`] =
        answer[option.value || option.label];
      return prev;
    }, {} as { [answer: string]: string });
  }
);

registerComponent<SpatialAccessPriorityProps, SAPValueType>(
  "SpatialAccessPriorityInput",
  (componentSettings, exportId) => {
    return [`${exportId}_sectors`, `${exportId}_feature_ids`];
  },
  (settings, exportId, answer) => {
    if (Array.isArray(answer)) {
      // Bug in (very) early rollout stored the wrong data structure internally
      // so selected sectors were lost.
      // https://github.com/seasketch/next/commit/3a69e33b14dd444b240edc24aa95d754099e2c25
      return {
        [`${exportId}_sectors`]: [
          "Unknown -- https://github.com/seasketch/next/commit/3a69e33b14dd444b240edc24aa95d754099e2c25",
        ],
        [`${exportId}_feature_ids`]: answer,
      };
    } else {
      return {
        [`${exportId}_sectors`]: answer.sectors,
        [`${exportId}_feature_ids`]: answer.collection || [],
      };
    }
  }
);
