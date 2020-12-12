import React from "react";
import { motion } from "framer-motion";

interface ProgressBarProps {
  /** 0.0 - 1.0 */
  progress: number;
}

// background: linear-gradient(-100deg, #f0f0f0 0%, #fafafa 50%, #f0f0f0 100%);
// background-size: 400% 400%;
// animation: pulse 1.2s ease-in-out infinite;
// margin-bottom: 4px;
// margin-top: 4px;
// @keyframes pulse {
//   0% {
//     background-position: 0% 0%;
//   }
//   100% {
//     background-position: -135% 0%;
//   }
// }

export default function ProgressBar(props: ProgressBarProps) {
  return (
    <div className="mb-2">
      <motion.div
        style={{
          background:
            "linear-gradient(-100deg, #d2d6dc 0%, #aeb1b4 50%, #d2d6dc 100%)",
          backgroundSize: "400% 400%",
        }}
        className="bg-gray-300 w-full my-4 h-3 mb-1"
        animate={{
          backgroundPosition: ["0% 0%", "-135% 0%", "0% 0%"],
          // scale: [1.5, 1],
        }}
        transition={{
          duration: 4,
          ease: "easeInOut",
          // times: [0, 1, 0],
          loop: Infinity,
          // repeatDelay: 0,
        }}
      >
        <div
          className="bg-primary-300 float-left h-3"
          style={{
            width: `${props.progress * 100}%`,
            transition: "width 500ms",
          }}
        >
          &nbsp;
        </div>
      </motion.div>
      {/* <span className="text-sm text-gray-500">
        {bytes(props.remaining, { decimalPlaces: 0 })} /{" "}
        {bytes(props.total, { decimalPlaces: 0 })} currently remaining
      </span> */}
    </div>
  );
}
