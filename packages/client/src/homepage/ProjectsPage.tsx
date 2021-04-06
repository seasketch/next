import React from "react";
import { useTranslation } from "react-i18next";
import Button from "../components/Button";
import SimpleProjectList from "./SimpleProjectList";

export default function ProjectsPage() {
  const { t } = useTranslation();
  return (
    <div>
      <SimpleProjectList />
      <div className="mx-auto max-w-lg">
        <Button href="/new-project" label={t("Create a Project")} />
      </div>
    </div>
  );
}
