import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import Badge from "../../components/Badge";
import {
  useSurveysQuery,
  useCreateSurveyMutation,
} from "../../generated/graphql";
import useProjectId from "../../useProjectId";

export default function SurveyList() {
  const projectId = useProjectId();
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation("admin:surveys");
  const { data } = useSurveysQuery({
    variables: {
      projectId: projectId!,
    },
  });
  const [createSurvey, createSurveyState] = useCreateSurveyMutation({});

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {[...(data?.project!.surveys || [])]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((survey) => (
            <li key={survey.id}>
              <Link to={`/${slug}/admin/surveys/${survey.id}`}>
                {/* <a href="#" className="block hover:bg-gray-50"> */}
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-primary-600 truncate">
                      {survey.name}
                    </p>
                    <div className="ml-2 flex-shrink-0 flex">
                      {!survey.isDisabled && <Badge>{t("Enabled")}</Badge>}
                      {survey.isTemplate && (
                        <Badge variant="warning">{t("Template")}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                {/* </a> */}
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}
