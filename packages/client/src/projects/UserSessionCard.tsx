import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { UserCircleIcon } from "@heroicons/react/solid";
import { UserIcon, LogoutIcon } from "@heroicons/react/outline";
import { ProfileStatusButton } from "../header/ProfileStatusButton";

interface UserSessionCardProps {
  /** Display string for the signed-in user, e.g. "user@example.com (google)" */
  userId: string;
  onEditProfile: () => void;
  onSignOut: () => void;
  animateText?: boolean;
}

/**
 * Account block for the project sidebar. Pairs a ringed user avatar with the
 * identity line, and presents the profile and sign-out actions as a balanced
 * pair of buttons.
 */
export default function UserSessionCard({
  userId,
  onEditProfile,
  onSignOut,
  animateText,
}: UserSessionCardProps) {
  const { t } = useTranslation("sidebar");

  const buttonClassName =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors focus:outline-0 focus-visible:ring-2 focus-visible:ring-blue-500";

  return (
    <div className="w-full pl-[22px] pr-4 py-1">
      <div className="flex items-center gap-3">
        <div className="flex-none h-8 w-8 rounded-full ring-2 ring-white/10">
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
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            {t("Signed in as")}
          </p>
          <p
            title={userId}
            className="text-sm font-medium text-gray-50 truncate"
          >
            {userId}
          </p>
        </motion.div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onEditProfile}
          className={`${buttonClassName} bg-white/5 hover:bg-white/10 ring-white/10 hover:ring-white/20 text-gray-100 hover:text-white`}
        >
          <UserIcon className="w-4 h-4" />
          {t("My Profile")}
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className={`${buttonClassName} bg-transparent hover:bg-red-500/10 ring-white/10 hover:ring-red-400/30 text-gray-300 hover:text-red-200`}
        >
          <LogoutIcon className="w-4 h-4" />
          {t("Sign Out")}
        </button>
      </div>
    </div>
  );
}
