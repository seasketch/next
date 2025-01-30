import { Trans } from "react-i18next";
import ProfilePhoto from "../../admin/users/ProfilePhoto";
import { AuthorProfileFragment } from "../../generated/graphql";

export default function AuthorProfilePopupContents({
  profile,
  onClose,
}: {
  profile: AuthorProfileFragment;
  onClose?: () => void;
}) {
  return (
    <div role="dialog" className="flex">
      <div className="w-16 h-16 flex-none m-1">
        <ProfilePhoto square canonicalEmail="" {...profile} />
      </div>
      <div className="flex-1 px-2">
        {profile.nickname && (
          <h3 className="text-base font-semibold">{profile.nickname}</h3>
        )}
        {profile.fullname && (
          <h3 className="text-base font-semibold">{profile.fullname}</h3>
        )}
        {profile.email && (
          <a
            target="_blank"
            href={`mailto:${profile.email}`}
            className="text-primary-500"
            rel="noreferrer"
          >
            {profile.email}
          </a>
        )}
        {profile.affiliations && <p>{profile.affiliations}</p>}
        <button
          autoFocus
          className="absolute"
          style={{ left: -999 }}
          onClick={onClose}
        >
          <Trans>close</Trans>
        </button>
      </div>
    </div>
  );
}
