import * as React from "react";
import { motion, MotionProps } from "framer-motion";
import { Props } from "framer-motion/types/types";

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
}: {
  onClick: () => void;
  className?: string;
}) => (
  <button
    className={`w-6 h-6 p-0 block active:outline-none focus:outline-none ${className}`}
    onClick={onClick}
    style={{ paddingLeft: 1 }}
  >
    <svg width="23" height="23" viewBox="0 0 23 23">
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
  </button>
);
