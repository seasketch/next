import { Trans } from "react-i18next";
import ProfilePhoto from "../../admin/users/ProfilePhoto";
import { AuthorProfileFragment } from "../../generated/graphql";

export default function AuthorProfilePopupContents({
  profile,
  canonicalEmail,
  onClose,
}: {
  profile: AuthorProfileFragment;
  canonicalEmail?: string | null;
  onClose?: () => void;
}) {
  const email = profile.email || canonicalEmail || null;
  return (
    <div role="dialog" className="flex">
      <div className="w-16 h-16 flex-none m-1">
        <ProfilePhoto
          square
          {...profile}
          canonicalEmail={canonicalEmail || ""}
        />
      </div>
      <div className="flex-1 px-2">
        {profile.nickname && (
          <h3 className="text-base font-semibold">{profile.nickname}</h3>
        )}
        {profile.fullname && (
          <h3 className="text-base font-semibold">{profile.fullname}</h3>
        )}
        {email && (
          <a
            target="_blank"
            href={`mailto:${email}`}
            className="text-primary-500"
            rel="noreferrer"
          >
            {email}
          </a>
        )}
        {profile.affiliations && <p>{profile.affiliations}</p>}
        <button
          autoFocus
          className="absolute"
          style={{ left: -9999 }}
          onClick={onClose}
        >
          <Trans>close</Trans>
        </button>
      </div>
    </div>
  );
}
