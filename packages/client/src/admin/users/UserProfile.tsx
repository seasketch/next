import { Trans, useTranslation } from "react-i18next";
import { Profile } from "../../generated/graphql";

interface ProfileProps {
  profile: Pick<
    Profile,
    "affiliations" | "fullname" | "nickname" | "bio" | "email" | "picture"
  >;
  canonicalEmail: string;
}

export default function UserProfile({ profile, canonicalEmail }: ProfileProps) {
  const { t } = useTranslation("admin");
  return (
    <div className="">
      <div className="">
        <div>
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              <Trans ns="admin">Profile</Trans>
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              <Trans ns="admin">
                User profiles are entered and maintained by the user. This
                information is shared along with any forum posts the user makes.
              </Trans>
            </p>
          </div>
        </div>
        <div className="mt-5 border-t border-gray-200">
          <dl className="divide-y divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">
                <Trans ns="admin">Full name</Trans>
              </dt>
              <dd className="mt-1 flex text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                <span className="flex-grow">
                  {profile.fullname || (
                    <span className="italic text-gray-500">
                      <Trans ns="admin">Not provided</Trans>
                    </span>
                  )}
                </span>
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">
                <Trans ns="admin">Nickname</Trans>
              </dt>
              <dd className="mt-1 flex text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                <span className="flex-grow">
                  {profile.nickname || (
                    <span className="italic text-gray-500">
                      <Trans ns="admin">Not provided</Trans>
                    </span>
                  )}
                </span>
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">
                <Trans ns="admin">Email</Trans>
              </dt>
              <dd className="mt-1 flex text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                <span className="flex-grow">
                  {profile.email || (
                    <span className="italic text-gray-500">
                      <Trans ns="admin">Not provided</Trans>
                    </span>
                  )}
                </span>
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">
                <Trans ns="admin">Affiliations</Trans>
              </dt>
              <dd className="mt-1 flex text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                <span className="flex-grow">
                  {profile.affiliations || (
                    <span className="italic text-gray-500">
                      <Trans ns="admin">Not provided</Trans>
                    </span>
                  )}
                </span>
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">
                <Trans ns="admin">Bio</Trans>
              </dt>
              <dd className="mt-1 flex text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                <span className="flex-grow">
                  {/* eslint-disable-next-line */}
                  {profile.bio || (
                    <span className="italic text-gray-500">
                      <Trans ns="admin">Not provided</Trans>
                    </span>
                  )}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
