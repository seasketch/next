import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import Button from "../../components/Button";
import useProjectId from "../../useProjectId";
import SurveyList from "./SurveyList";
import { useCreateSurveyMutation } from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { gql } from "@apollo/client";
import { useParams } from "react-router";
import SurveyDetail from "./SurveyDetail";

export default function SurveyAdmin() {
  const projectId = useProjectId();
  const { t } = useTranslation("admin:surveys");
  const { surveyId } = useParams<{ slug: string; surveyId?: string }>();
  const onError = useGlobalErrorHandler();
  const [createSurvey] = useCreateSurveyMutation({
    onError,
  });

  if (surveyId) {
    return <SurveyDetail surveyId={parseInt(surveyId)} />;
  } else {
    return (
      <div className="sm:mt-5 max-w-xl ml-auto mr-auto">
        <AnimatePresence initial={false}>
          {/* TODO: add template choice to create-survey steps and animate transition between pages */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SurveyList />
            <div className="text-center p-5">
              <Button
                primary
                className="relative right-0"
                label={t("Create a New Survey")}
                onClick={async () => {
                  const name = window.prompt(
                    t("Choose a name for your survey")
                  );
                  if (name) {
                    await createSurvey({
                      variables: {
                        projectId: projectId!,
                        name,
                      },
                      update: (cache, { data }) => {
                        if (data?.makeSurvey?.survey) {
                          const newSurveyData = data.makeSurvey.survey;
                          cache.modify({
                            id: cache.identify({
                              __typename: "Project",
                              id: newSurveyData.projectId,
                            }),
                            fields: {
                              surveys(existingSurveyRefs = [], { readField }) {
                                const newSurveyRef = cache.writeFragment({
                                  data: newSurveyData,
                                  fragment: gql`
                                    fragment NewSurvey on Survey {
                                      id
                                      accessType
                                      invitedGroups {
                                        id
                                        name
                                      }
                                      isDisabled
                                      limitToSingleResponse
                                      name
                                      submittedResponseCount
                                      projectId
                                    }
                                  `,
                                });
                                return [...existingSurveyRefs, newSurveyRef];
                              },
                            },
                          });
                        }
                      },
                    });
                  }
                }}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }
}
