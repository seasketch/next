import clsx from "clsx";
import { motion } from "framer-motion";

const Path = (props: any) => (
  <motion.path
    fill="transparent"
    strokeWidth="3"
    stroke="currentColor"
    strokeLinecap="round"
    {...props}
  />
);

export const MenuToggle = ({
  onClick,
  className,
  tabIndex,
  isExpanded,
  animating,
}: {
  onClick: () => void;
  className?: string;
  tabIndex?: number;
  isExpanded?: boolean;
  animating?: boolean;
}) => (
  <button
    title={isExpanded ? "Collapse Navigation" : "Expand Navigation"}
    className={clsx(
      `flex items-center justify-center w-9 h-9 rounded p-0 active:outline-none focus:outline-none focus-visible:ring-2 ring-blue-500 focus:bg-gray-700 active:bg-gray-700 hover:bg-blue-500/15`,
      animating ? "opacity-0" : "opacity-100 transition-opacity duration-300",
      className
    )}
    onClick={onClick}
    style={{ paddingLeft: 1 }}
    tabIndex={tabIndex}
  >
    {isExpanded ? (
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
    ) : (
      <svg className="mr-1" width="24" height="19" viewBox="0 0 19 19">
        <Path
          initial={{ d: "M 2 2.5 L 20 2.5" }}
          variants={{
            closed: { d: "M 2 2.5 L 20 2.5" },
            open: { d: "M 3 16.5 L 17 2.5" },
          }}
        />
        <Path
          initial={{ opacity: 1 }}
          d="M 2 9.423 L 20 9.423"
          variants={{
            closed: { opacity: 1 },
            open: { opacity: 0 },
          }}
          transition={{ duration: 0.1 }}
        />
        <Path
          initial={{ d: "M 2 16.346 L 20 16.346" }}
          variants={{
            closed: { d: "M 2 16.346 L 20 16.346" },
            open: { d: "M 3 2.5 L 17 16.346" },
          }}
        />
      </svg>
    )}
  </button>
);
