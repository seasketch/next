import { useAuth0 } from "@auth0/auth0-react";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import ProfilePhoto from "../admin/users/ProfilePhoto";
import { useMeQuery, useUpdateProfileMutation } from "../generated/graphql";
import Button from "./Button";
import { useGlobalErrorHandler } from "./GlobalErrorHandler";
import Spinner from "./Spinner";

export default function ProfileAvatarUploader() {
  const auth0 = useAuth0();
  const onError = useGlobalErrorHandler();
  const { data } = useMeQuery({
    fetchPolicy: "cache-and-network",
    onError,
  });
  const [mutate, mutationState] = useUpdateProfileMutation({ onError });
  const { t } = useTranslation("userProfile");

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        <div className="w-12 h-12 mr-2 ml-1">
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
        <input
          id="profile-picture-input"
          type="file"
          title="choose"
          accept="image/png, image/jpeg, image/gif"
          disabled={mutationState.loading}
          // {...getInputProps()}
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
        <label
          className="z-50 border shadow-sm p-1 px-2 text-sm rounded cursor-pointer flex items-center space-x-2"
          // loading={mutationState.loading}
          htmlFor="profile-picture-input"
        >
          {mutationState.loading && <Spinner />}
          <span>
            {mutationState.loading ? t("Uploading") : t("Choose Avatar Photo")}
          </span>
        </label>
      </div>
    </>
  );
}
