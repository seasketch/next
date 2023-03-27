import React, { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ProfileControl from "../header/ProfileControl";
import useCurrentProjectMetadata from "../useCurrentProjectMetadata";

export default function ProjectAppHeader() {
  const { t, i18n } = useTranslation("nav");
  const { data, loading, error } = useCurrentProjectMetadata();

  let logo: ReactNode | null = null;
  if (data?.project?.logoUrl) {
    logo = <img src={data.project.logoUrl} className="w-8 h-8 mr-2 inline" />;
    if (data.project.logoLink) {
      logo = (
        <a href={data.project.logoLink} target="_blank">
          {logo}
        </a>
      );
    }
  }

  return (
    <div className="w-full h-12 flex-0">
      <div className="p-2 pl-5 flex place-items-center mr-auto ml-auto">
        <div className="flex-grow">
          {logo}
          {data?.project?.name}
        </div>
        <div className="flex-0">
          <ProfileControl />
        </div>
      </div>
    </div>
  );
}
