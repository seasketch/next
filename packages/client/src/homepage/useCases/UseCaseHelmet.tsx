/* eslint-disable i18next/no-literal-string */
import SiteHelmet from "../SiteHelmet";
import { UseCaseDefinition } from "./useCaseDefs";

export default function UseCaseHelmet({ useCase }: { useCase: UseCaseDefinition }) {
  return (
    <SiteHelmet
      title={useCase.title}
      description={useCase.summary}
      path={useCase.to}
      ogImage={useCase.shareImage}
    />
  );
}
