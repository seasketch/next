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
  groupResponse: boolean;
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
      groupResponse: boolean,
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
        groupResponse,
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

export function downloadOfflineSurveyResponses() {
  localforage.getItem(OFFLINE_SURVEY_RESPONSES_KEY).then((value) => {
    if (value && Array.isArray(value) && value.length) {
      const jsonString = JSON.stringify(value, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      // eslint-disable-next-line i18next/no-literal-string
      a.download = `responses-${new Date().toLocaleDateString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      throw new Error("No offline survey responses to download");
    }
  });
}
