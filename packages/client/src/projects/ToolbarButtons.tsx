import { ReactNode, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useHistory } from "react-router-dom";
import { CogIcon, TranslateIcon } from "@heroicons/react/solid";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { ProfileStatusButton } from "../header/ProfileStatusButton";

interface SidebarButtonProps {
  className?: string;
  onClick?: () => void;
  icon: ReactNode;
  tabIndex?: number;
  tooltip?: string;
  href?: string;
  anySidebarOpen?: boolean;
  sidebarOpen?: boolean;
  hidden?: boolean;
  expanded?: boolean;
  variant?: "primary" | "secondary";
}

const curry =
  (icon: ReactNode) =>
  (
    props: Pick<
      SidebarButtonProps,
      | "className"
      | "onClick"
      | "tabIndex"
      | "tooltip"
      | "href"
      | "anySidebarOpen"
      | "sidebarOpen"
      | "hidden"
      | "expanded"
      | "variant"
    >
  ) =>
    <SidebarButton {...props} icon={icon} />;

export default function SidebarButton(props: SidebarButtonProps) {
  const [hovered, setHovered] = useState(false);
  const history = useHistory();
  let onClick = props.onClick;
  if (props.href) {
    const href = props.href;
    onClick = () => {
      history.push(href);
      setHovered(false);
    };
  }
  if (props.hidden) {
    return null;
  }
  if (props.expanded) {
    return (
      <div style={{ padding: "0px 19px" }} className="w-full">
        <button
          key={props.tooltip}
          className={`flex items-center w-full space-x-2 focus:outline-blue-500 rounded p-1 ${
            props.variant === "primary"
              ? "bg-cool-gray-700 bg-opacity-60 py-3 mt-4 justify-center text-center rounded"
              : ""
          }`}
          onClick={() => {
            if (onClick) {
              onClick();
            }
            setHovered(false);
          }}
        >
          {/* <div className="w-full px-2 flex items-center space-x-2"> */}
          <span className="w-7 h-7 text-gray-400 flex-none">{props.icon}</span>
          <span className="whitespace-nowrap overflow-hidden">
            {props.tooltip}
          </span>
          {/* </div> */}
        </button>
      </div>
    );
  }
  return (
    <motion.button
      key={props.tooltip}
      onFocus={(e) => {
        setHovered(true);
      }}
      onBlur={(e) => {
        setHovered(false);
      }}
      onMouseOut={(e) => {
        setHovered(false);
        // @ts-ignore
        e.target.blur();
      }}
      onMouseOver={() => setHovered(true)}
      tabIndex={props.tabIndex}
      onClick={() => {
        if (onClick) {
          onClick();
        }
        setHovered(false);
      }}
      className={`w-10 h-10 ${
        props.className
      } hover:bg-primary-300 hover:bg-opacity-10 focus:bg-white focus:bg-opacity-10 rounded p-1.5 focus:outline-none relative active:outline-none focus:ring-2 ring-blue-500 ${
        props.sidebarOpen ? "bg-opacity-20 bg-primary-300" : ""
      }`}
    >
      <span>{props.icon}</span>
      <AnimatePresence>
        {props.tooltip && hovered === true && !props.sidebarOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: { delay: props.anySidebarOpen ? 0.5 : 0.2 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="absolute left-14 z-0 top-1 bg-black px-2 py-1 rounded overflow-visible whitespace-nowrap pointer-events-none select-none"
          >
            {props.tooltip}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export const MapIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
    />
  </svg>
);

export const AboutIcon = (
  <QuestionMarkCircledIcon className="w-6 h-6 transform scale-110 inline-block" />
);

export const AboutButton = curry(AboutIcon);

export const MapButton = curry(MapIcon);

export const CacheIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    // className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
    />
  </svg>
);

export const CacheButton = curry(CacheIcon);

export const LayerIcon = (
  <svg
    viewBox="1.5 1 21 21"
    focusable="false"
    role="img"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g data-name="Layer 2">
      <path
        d="M21 11.35a1 1 0 00-.61-.86l-2.15-.92 2.26-1.3a1 1 0 00.5-.92 1 1 0 00-.61-.86l-8-3.41a1 1 0 00-.78 0l-8 3.41a1 1 0 00-.61.86 1 1 0 00.5.92l2.26 1.3-2.15.92a1 1 0 00-.61.86 1 1 0 00.5.92l2.26 1.3-2.15.92a1 1 0 00-.61.86 1 1 0 00.5.92l8 4.6a1 1 0 001 0l8-4.6a1 1 0 00.5-.92 1 1 0 00-.61-.86l-2.15-.92 2.26-1.3a1 1 0 00.5-.92zm-9-6.26l5.76 2.45L12 10.85 6.24 7.54zm-.5 7.78a1 1 0 001 0l3.57-2 1.69.72L12 14.85l-5.76-3.31 1.69-.72zm6.26 2.67L12 18.85l-5.76-3.31 1.69-.72 3.57 2.05a1 1 0 001 0l3.57-2.05z"
        data-name="layers"
      ></path>
    </g>
  </svg>
);
export const LayersButton = curry(LayerIcon);

export const MyProfileIcon = (
  <div className="w-7 h-7 flex items-center justify-center">
    <ProfileStatusButton tabIndex={-1} />
  </div>
);

export const MyProfileButton = curry(MyProfileIcon);

export const EditProfileButton = curry(
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-6 h-6"
  >
    <path
      fillRule="evenodd"
      d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
      clipRule="evenodd"
    />
  </svg>
);

export const SignInButton = curry(
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

export const SignOutButton = curry(
  <svg
    className="left-0.5 relative"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

export const SketchingIcon = (
  <svg
    viewBox="0 0 448 512"
    className="ml-auto mr-auto"
    width="90%"
    height="90%"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="currentColor"
      d="M384 352c-.35 0-.67.1-1.02.1l-39.2-65.32c5.07-9.17 8.22-19.56 8.22-30.78s-3.14-21.61-8.22-30.78l39.2-65.32c.35.01.67.1 1.02.1 35.35 0 64-28.65 64-64s-28.65-64-64-64c-23.63 0-44.04 12.95-55.12 32H119.12C108.04 44.95 87.63 32 64 32 28.65 32 0 60.65 0 96c0 23.63 12.95 44.04 32 55.12v209.75C12.95 371.96 0 392.37 0 416c0 35.35 28.65 64 64 64 23.63 0 44.04-12.95 55.12-32h209.75c11.09 19.05 31.49 32 55.12 32 35.35 0 64-28.65 64-64 .01-35.35-28.64-64-63.99-64zm-288 8.88V151.12A63.825 63.825 0 00119.12 128h208.36l-38.46 64.1c-.35-.01-.67-.1-1.02-.1-35.35 0-64 28.65-64 64s28.65 64 64 64c.35 0 .67-.1 1.02-.1l38.46 64.1H119.12A63.748 63.748 0 0096 360.88zM272 256c0-8.82 7.18-16 16-16s16 7.18 16 16-7.18 16-16 16-16-7.18-16-16zM400 96c0 8.82-7.18 16-16 16s-16-7.18-16-16 7.18-16 16-16 16 7.18 16 16zM64 80c8.82 0 16 7.18 16 16s-7.18 16-16 16-16-7.18-16-16 7.18-16 16-16zM48 416c0-8.82 7.18-16 16-16s16 7.18 16 16-7.18 16-16 16-16-7.18-16-16zm336 16c-8.82 0-16-7.18-16-16s7.18-16 16-16 16 7.18 16 16-7.18 16-16 16z"
    ></path>
  </svg>
);

export const SketchingButton = curry(SketchingIcon);

export const ForumsIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
    />
  </svg>
);
export const ForumsButton = curry(ForumsIcon);

export const AdminIcon = (
  <CogIcon className="w-6 h-6 inline-block text-gray-300" />
);
// export const AdminIcon = (
//   // <div className="bg-gray-700 rounded py-1 px-1 flex items-center">
//   <svg
//     xmlns="http://www.w3.org/2000/svg"
//     viewBox="0 0 24 24"
//     fill="currentColor"
//     className="w-6 h-6 inline-block text-gray-300"
//   >
//     <path
//       fillRule="evenodd"
//       d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z"
//       clipRule="evenodd"
//     />
//   </svg>
//   // </div>
// );
export const AdminButton = curry(
  AdminIcon
  // <svg
  //   xmlns="http://www.w3.org/2000/svg"
  //   fill="none"
  //   viewBox="0 0 24 24"
  //   stroke="currentColor"
  // >
  //   <path
  //     strokeLinecap="round"
  //     strokeLinejoin="round"
  //     strokeWidth={2}
  //     d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
  //   />
  // </svg>
);

export const SettingsIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    role="img"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);
export const SettingsButton = curry(SettingsIcon);

export const LanguageIcon = (
  <TranslateIcon style={{ marginLeft: 1 }} className="w-7 h-7 inline-block " />
);

export const LanguageButton = curry(LanguageIcon);
