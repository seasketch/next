import React, { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useCurrentProjectMetadataQuery } from "../generated/graphql";
import { useTranslation } from "react-i18next";
import ProfileControl from "../header/ProfileControl";

export default function ProjectAppHeader() {
  const { t, i18n } = useTranslation(["nav"]);
  const { slug } = useParams<{ slug: string }>();
  const { data, loading, error } = useCurrentProjectMetadataQuery({
    variables: {
      slug,
    },
  });

  let logo: ReactNode | null = null;
  if (data?.projectBySlug?.logoUrl) {
    logo = (
      <img src={data.projectBySlug.logoUrl} className="w-8 h-8 mr-2 inline" />
    );
    if (data.projectBySlug.logoLink) {
      logo = (
        <a href={data.projectBySlug.logoLink} target="_blank">
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
          {data?.projectBySlug?.name}
        </div>
        <div className="flex-0">
          <ProfileControl />
        </div>
      </div>
    </div>
  );
}
