import React, { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useCurrentProjectMetadataQuery } from "../generated/graphql";
import { useTranslation } from "react-i18next";
import ProfileControl from "../header/ProfileControl";

export default function ProjectAppHeader() {
  const { t, i18n } = useTranslation(["nav"]);
  const { data, loading, error } = useCurrentProjectMetadataQuery();

  let logo: ReactNode | null = null;
  if (data?.currentProject?.logoUrl) {
    logo = (
      <img src={data.currentProject.logoUrl} className="w-8 h-8 mr-2 inline" />
    );
    if (data.currentProject.logoLink) {
      logo = (
        <a href={data.currentProject.logoLink} target="_blank">
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
          {data?.currentProject?.name}
        </div>
        <div className="flex-0">
          <ProfileControl />
        </div>
      </div>
    </div>
  );
}
