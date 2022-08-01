import localforage from "localforage";
import { useCallback, useEffect, useState } from "react";
import { v4 as uuid } from "uuid";

type OfflineSurveyResponse = {
  offlineId: string;
  responseData: {
    [formElementId: number]: any;
  };
  surveyId: number;
  projectId: number;
  facilitated: boolean;
  practice: boolean;
};

const OFFLINE_SURVEY_RESPONSES_KEY = "offline-survey-responses";

export default function useOfflineSurveyResponses() {
  const [responses, setResponses] = useState<OfflineSurveyResponse[]>([]);

  useEffect(() => {
    localforage.getItem(OFFLINE_SURVEY_RESPONSES_KEY).then((value) => {
      if (value && Array.isArray(value) && value.length) {
        setResponses(value);
      } else {
        setResponses([]);
      }
    });
  }, []);

  const addResponse = useCallback(
    async (
      surveyId: number,
      projectId: number,
      facilitated: boolean,
      practice: boolean,
      responseData: { [formElementId: number]: any }
    ) => {
      const responses = ((await localforage.getItem(
        OFFLINE_SURVEY_RESPONSES_KEY
      )) || []) as OfflineSurveyResponse[];
      responses.push({
        offlineId: uuid(),
        surveyId,
        projectId,
        facilitated,
        practice,
        responseData,
      });
      await localforage.setItem(OFFLINE_SURVEY_RESPONSES_KEY, responses);
      setResponses([...responses]);
    },
    []
  );

  const clearResponses = useCallback(() => {
    localforage.removeItem(OFFLINE_SURVEY_RESPONSES_KEY);
    setResponses([]);
  }, []);

  const removeResponse = useCallback(async (offlineId: string) => {
    const responses = ((await localforage.getItem(
      OFFLINE_SURVEY_RESPONSES_KEY
    )) || []) as OfflineSurveyResponse[];
    const filtered = responses.filter((r) => r.offlineId !== offlineId);
    await localforage.setItem(OFFLINE_SURVEY_RESPONSES_KEY, filtered);
    setResponses(filtered);
  }, []);

  return {
    responses,
    addResponse,
    clearResponses,
    removeResponse,
  };
}
