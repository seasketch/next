import { motion } from "framer-motion";
import React, { FunctionComponent } from "react";

export interface BadgeProps {
  variant?: "primary" | "secondary" | "warning" | "error" | "green";
  className?: string;
  style?: React.CSSProperties;
  animate?: boolean;
}

const colors = {
  primary: "bg-blue-100 text-blue-800",
  secondary: "bg-gray-100 text-gray-800",
  warning: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
  green: "bg-green-200 text-green-800",
};

const Badge: FunctionComponent<BadgeProps> = (props) => {
  // eslint-disable-next-line i18next/no-literal-string
  const className = `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
    colors[props.variant || "primary"]
  } ${props.className}`;
  if (props.animate && props.variant && props.variant !== "secondary") {
    const spring = {
      type: "spring",
      damping: 7,
      stiffness: 100,
    };
    return (
      <motion.span
        transition={spring}
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        style={props.style}
        className={className}
      >
        {props.children}
      </motion.span>
    );
  } else {
    return (
      <span style={props.style} className={className}>
        {props.children}
      </span>
    );
  }
};

export default Badge;
