import React, {
  createContext,
  ReactNode,
  useContext,
  useState,
  useMemo,
} from "react";
import { motion } from "framer-motion";
import { useMediaQuery } from "beautiful-react-hooks";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface ContextValue {
  isSmall: boolean;
  toolbarDiv?: HTMLDivElement | null;
}

export const ProjectAppSidebarContext = createContext<ContextValue>({
  // toolbar: null,
  isSmall: false,
  // setToolbar: (contents: ReactNode) => {},
});

const ProjectAppSidebar: React.FunctionComponent<{
  title: string;
  onClose: () => void;
  dark: boolean;
  toolbar?: HTMLDivElement | null;
  hidden?: boolean;
  noPadding?: boolean;
}> = (props) => {
  const [toolbarDiv, setToolbarDiv] = useState<HTMLDivElement | null>(null);
  const isSmall = useMediaQuery("(max-width: 1535px)");
  const isMobile = useMediaQuery(
    "only screen and (max-width: 768px) and (orientation: portrait)"
  );
  const { t } = useTranslation("homepage");
  return (
    <motion.section
      aria-hidden={props.hidden}
      aria-labelledby="sidebar-header"
      initial={{ opacity: 0, translateX: -320 }}
      animate={props.hidden ? "hidden" : "visible"}
      variants={{
        hidden: { opacity: 0, translateX: -320, pointerEvents: "none" },
        visible: { opacity: 1, translateX: 0, pointerEvents: "auto" },
      }}
      transition={{
        bounce: false,
        duration: 0.2,
      }}
      // exit={{
      //   opacity: 0,
      //   translateX: -320,
      //   transition: {
      //     bounce: false,
      //   },
      // }}
      className={`flex-col flex absolute left-16 top-0 h-full overflow-hidden z-10 ${
        props.dark ? "bg-gray-50" : "bg-gray-50"
      } w-72 md:w-96 2xl:w-128`}
      style={{
        boxShadow:
          "0 1px 3px 0 rgba(0, 0, 0, 0.2), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        ...(isMobile ? { width: "calc(100vw - 64px)" } : {}),
      }}
    >
      <div className="flex w-full bg-primary-800 bg-gradient-to-bl from-gray-700 to-primary-800 p-4 text-white shadow-lg">
        <h2
          aria-label={props.title}
          id="sidebar-header"
          className="text-2xl flex flex-1 items-center"
        >
          {props.title}
        </h2>
        <button
          aria-hidden={props.hidden}
          aria-label={t("Close sidebar")}
          title={t("Close sidebar")}
          disabled={props.hidden}
          onClick={props.onClose}
          className=" w-10 h-10 rounded-full p-1 relative -right-2 flex items-center flex-grow-0 outline-0 focus-visible:ring-2 ring-blue-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            className="w-full h-full"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>
      <div ref={setToolbarDiv}></div>
      <ProjectAppSidebarContext.Provider value={{ toolbarDiv, isSmall }}>
        <div
          className={`childin ${
            props.noPadding ? "" : "p-4 pt-2"
          } flex-1 overflow-y-auto overflow-x-hidden`}
        >
          {props.children}
        </div>
      </ProjectAppSidebarContext.Provider>
    </motion.section>
  );
};

export const ProjectAppSidebarToolbar = React.forwardRef<
  any,
  {
    ref?: (el: HTMLDivElement | null) => void;
    children?: ReactNode;
  }
>((props, ref) => {
  const context = useContext(ProjectAppSidebarContext);

  const target = useMemo(() => {
    if (context.toolbarDiv) {
      return context.toolbarDiv;
    } else {
      return null;
    }
  }, [context.toolbarDiv]);

  if (target) {
    return createPortal(
      <div
        className="bg-gray-100 p-2 px-4 flex items-center space-x-2 border-b shadow-sm toolbarParentContainer"
        // @ts-ignore
        ref={ref}
      >
        {props.children}
      </div>,
      target
    );
  } else {
    return null;
  }
});
export default ProjectAppSidebar;

export function currentSidebarState() {
  const isSmall = window.matchMedia("(max-width: 1535px)").matches;
  const open = /\/app\/\w+/.test(window.location.pathname);
  return {
    isSmall,
    open,
    width: isSmall ? 384 : 512,
  };
}
