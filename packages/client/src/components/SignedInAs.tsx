import { useAuth0 } from "@auth0/auth0-react";
import { UserCircleIcon } from "@heroicons/react/solid";
import { useTranslation } from "react-i18next";
import { ProfileStatusButton } from "../header/ProfileStatusButton";
import { motion } from "framer-motion";

export default function SignedInAs({
  className,
  onClick,
  tabIndex,
  animateText,
}: {
  className?: string;
  onClick?: () => void;
  tabIndex?: number;
  animateText?: boolean;
}) {
  const { t } = useTranslation("common");
  const { user, logout } = useAuth0();
  let social: string | false = false;
  if (user?.sub) {
    if (/twitter/.test(user.sub)) {
      social = "twitter";
    } else if (/google/.test(user.sub)) {
      social = "google";
    } else if (/github/.test(user.sub)) {
      social = "github";
    }
  }
  const userId = user
    ? `${user.email || user.name} ${social ? `(${social})` : ""}`
    : false;

  return (
    <div
      className={`flex ${className} ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <ProfileStatusButton tabIndex={tabIndex}>
        <div className="flex items-center">
          <UserCircleIcon className="w-10 h-10 text-gray-500" />
        </div>
      </ProfileStatusButton>
      <motion.div
        className="ml-2"
        initial={animateText ? { opacity: 0 } : {}}
        animate={animateText ? { opacity: 1 } : {}}
        transition={{ duration: 0.2 }}
      >
        <p className="text-base md:text-sm leading-5">
          {userId ? t("Signed in as") : t("Not signed in")}
        </p>
        <p
          title={userId as string}
          className="text-base md:text-sm leading-8 md:leading-5 font-medium truncate"
        >
          {userId || "Anonymous"}
        </p>
      </motion.div>
    </div>
  );
}
