import { useAuth0 } from "@auth0/auth0-react";
import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import ProfilePhoto from "../admin/users/ProfilePhoto";
import { useMeQuery, useUpdateProfileMutation } from "../generated/graphql";
import ProjectAppSidebar from "../projects/ProjectAppSidebar";
import useCurrentProjectMetadata from "../useCurrentProjectMetadata";
import Button from "./Button";
import { useGlobalErrorHandler } from "./GlobalErrorHandler";

export default function ProfileAvatarUploader() {
  const auth0 = useAuth0();
  const onError = useGlobalErrorHandler();
  const { data, loading, error } = useMeQuery({
    fetchPolicy: "cache-and-network",
    onError,
  });
  const [mutate, mutationState] = useUpdateProfileMutation({ onError });
  const { t } = useTranslation();

  const onDrop = useCallback(
    (acceptedFiles) => {
      if (!data?.me) {
        throw new Error(
          "currentProjectMetadataQuery did not complete or does not contain user id"
        );
      }
      mutate({
        variables: {
          userId: data.me.id,
          picture: acceptedFiles[0],
        },
      });
    },
    [data?.me, mutate]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <>
      <div
        {...getRootProps()}
        className={`-ml-1 mt-2 flex items-center ${
          isDragActive
            ? "border-dashed border-2 rounded-lg border-gray-300 -ml-1.5 mt-1.5 -mb-0.5"
            : ""
        }`}
      >
        <div className="w-16 h-16">
          <ProfilePhoto
            canonicalEmail={auth0.user?.email || ""}
            fullname={data?.me?.profile?.fullname}
            picture={data?.me?.profile?.picture}
            email={
              data?.me?.profile?.email ||
              auth0.user?.email ||
              "example@example.com"
            }
            defaultImg="mm"
          />
        </div>
        <Button
          small
          label={
            mutationState.loading ? t("Uploading") : t("Upload Avatar Photo")
          }
          loading={mutationState.loading}
          labelFor="profile-picture-input"
        />
        <input
          // {...getInputProps()}
          id="profile-picture-input"
          type="file"
          title="choose"
          accept="image/png, image/jpeg, image/gif"
          disabled={mutationState.loading}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              const target = e.target;
              mutate({
                variables: {
                  userId: data!.me!.id,
                  picture: e.target.files[0],
                },
              })
                .catch((e) => {})
                .then(() => {
                  target.value = "";
                });
            }
          }}
          className="hidden py-2 px-1 text-sm leading-1 font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:bg-gray-50 active:text-gray-800 transition duration-150 ease-in-out"
        />
      </div>
    </>
  );
}
