import { FeatureCollection, Geometry } from "geojson";

export type SurveyResponse = {
  id: number;
  surveyId: number;
  createdAt: string;
  updatedAt?: string;
  isPractice: boolean;
  isDuplicateIp: boolean;
  userId?: number;
  data: { [key: string]: any };
  accountEmail?: string;
};

export type FormElement = {
  typeId: string;
  componentSettings: { [key: string]: any };
  exportId: string;
  position: number;
  id: number;
  isInput: boolean;
};

export function getDataForExport(
  responses: SurveyResponse[],
  formElements: FormElement[]
): [{ [column: string]: string | number | null }, string[]];

export function normalizeSpatialProperties(
  surveyId: number,
  collection: FeatureCollection<
    Geometry,
    { [key: string]: any } & { response_id: number; name: string }
  >,
  formElements: FormElement[]
): FeatureCollection<
  Geometry,
  { [key: string]: any } & { response_id: number; name: string }
>;
