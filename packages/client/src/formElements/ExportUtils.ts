/* eslint-disable i18next/no-literal-string */
import {
  FormElementDetailsFragment,
  SurveyAppRuleFragment,
  SurveyResponse,
} from "../generated/graphql";
import { sortFormElements } from "./sortFormElements";
import { Feature, FeatureCollection, Geometry } from "geojson";
import { componentExportHelpers } from ".";
import { getUnskippedInputElementsForCompletedResponse } from "../surveys/paging";

export function getAnswers(
  componentName: string,
  exportId: string,
  componentSettings: any,
  answer: any
) {
  return componentExportHelpers[componentName].getAnswers!(
    componentSettings,
    exportId,
    answer
  );
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
  formElements: FormElement[],
  rules: Pick<
    SurveyAppRuleFragment,
    "booleanOperator" | "conditions" | "jumpToId" | "position" | "formElementId"
  >[]
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
      columns.push(
        ...componentExportHelpers[element.typeId].getColumns!(
          element.componentSettings,
          element.exportId!
        )
      );
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
    const elements = getUnskippedInputElementsForCompletedResponse(
      sortedElements,
      rules,
      response.data
    );
    const answers = getAnswersAsProperties(elements, response.data);
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
    { [key: string]: any } & { response_id: number; response_data: any }
  >,
  formElements: FormElement[]
) {
  const sortedElements = sortFormElements(formElements);
  const features: Feature[] = [];
  for (const feature of collection.features) {
    const responseData = feature.properties.response_data;
    const newProperties = {
      survey_id: surveyId,
      response_id: feature.properties.response_id,
      ...getAnswersAsProperties(sortedElements, feature.properties),
      ...(feature.properties.area_sq_meters
        ? { area_sq_meters: feature.properties.area_sq_meters }
        : {}),
      ...(responseData.sectors ? { sector: feature.properties.sector } : {}),
    };
    if (
      !responseData ||
      !responseData.sectors ||
      responseData.sectors.indexOf(feature.properties.sector) !== -1
    ) {
      features.push({
        ...feature,
        properties: newProperties,
      });
    } else {
      // SpatialAccessPriority field. Need to filter shapes to only selected
      // sectors. User might otherwise draw shapes for a bunch of sectors, but
      // then limit their selection later.
    }
  }

  return {
    ...collection,
    features,
  };
}
