import React from "react";
import { motion } from "framer-motion";

const ProjectAppSidebar: React.FunctionComponent<{
  title: string;
  onClose: () => void;
  dark: boolean;
}> = (props) => {
  return (
    <motion.div
      initial={{ opacity: 0, translateX: -320 }}
      animate={{
        opacity: 1,
        translateX: 0,
        transition: {
          duration: 0.2,
        },
      }}
      exit={{
        opacity: 0,
        translateX: -320,
        transition: {
          bounce: false,
        },
      }}
      className={`absolute left-16 top-0 h-full overflow-y-scroll z-10 ${
        props.dark ? "bg-gray-50" : "bg-gray-50"
      } w-72 md:w-96 2xl:w-128 p-4`}
      style={{
        boxShadow:
          "0 1px 3px 0 rgba(0, 0, 0, 0.2), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
      }}
    >
      <div className="flex w-full mb-2">
        <h1 className="text-2xl flex flex-1 items-center">{props.title}</h1>
        <button
          onClick={props.onClose}
          className=" w-10 h-10 rounded-full p-1 relative -right-2 flex items-center flex-grow-0"
        >
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>
      <div className="childin">{props.children}</div>
    </motion.div>
  );
};

export default ProjectAppSidebar;
