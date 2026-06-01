import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { UserCircleIcon } from "@heroicons/react/solid";
import { ProfileStatusButton } from "../header/ProfileStatusButton";

interface UserSessionCardProps {
  /** Display string for the signed-in user, e.g. "user@example.com (google)" */
  userId: string;
  onEditProfile: () => void;
  onSignOut: () => void;
  animateText?: boolean;
}

/**
 * Compact account block for the project sidebar. Pairs the user avatar with the
 * "Signed in as" label and consolidates the profile and sign-out actions into
 * inline links to conserve vertical space on short viewports.
 */
export default function UserSessionCard({
  userId,
  onEditProfile,
  onSignOut,
  animateText,
}: UserSessionCardProps) {
  const { t } = useTranslation("sidebar");

  const linkClassName =
    "text-base font-medium text-gray-100 hover:text-white underline decoration-gray-500/70 hover:decoration-white underline-offset-[3px] py-1 focus:outline-0 focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm transition-colors";

  return (
    <div className="w-full pl-[22px] pr-4 py-1">
      <div className="flex items-start gap-3">
        <div className="flex-none mt-0.5">
          <ProfileStatusButton tabIndex={-1}>
            <div className="flex items-center">
              <UserCircleIcon className="w-8 h-8 text-gray-500" />
            </div>
          </ProfileStatusButton>
        </div>
        <motion.div
          className="min-w-0 flex-1"
          initial={animateText ? { opacity: 0 } : false}
          animate={animateText ? { opacity: 1 } : undefined}
          transition={{ duration: 0.2 }}
        >
          <p className="text-sm leading-4 text-gray-400">
            {t("Signed in as")}
          </p>
          <p
            title={userId}
            className="text-base leading-5 font-medium text-gray-100 truncate"
          >
            {userId}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onEditProfile}
              className={linkClassName}
            >
              {t("My Profile")}
            </button>
            <span aria-hidden className="text-gray-500/50">
              |
            </span>
            <button type="button" onClick={onSignOut} className={linkClassName}>
              {t("Sign Out")}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
