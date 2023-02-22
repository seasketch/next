import { XIcon } from "@heroicons/react/outline";
import { AnimatePresence, motion } from "framer-motion";
import { memo, useEffect, useRef, useState } from "react";
import "./TableOfContents.css";

const DEBUG_SLOW = false;

function VisibilityCheckboxAnimated(props: {
  id: number | string;
  onClick?: () => void;
  disabled: boolean;
  visibility: boolean | "mixed";
  error?: string | null;
  radio?: boolean;
  className?: string;
  loading?: boolean;
  ariaLabelledBy?: string;
}) {
  const [slow, setSlow] = useState(false);
  const timeout = useRef<any | undefined>(undefined);

  useEffect(() => {
    if (!props.loading) {
      setSlow(false);
      if (timeout.current) {
        clearTimeout(timeout.current);
        timeout.current = undefined;
      }
    } else if (!timeout.current) {
      timeout.current = setTimeout(() => {
        setSlow(true);
        timeout.current = undefined;
      }, 1500);
    }
  }, [props.loading, timeout]);
  return (
    <div
      tabIndex={0}
      onKeyDown={(e) => {
        if (props.onClick && e.key === " ") {
          props.onClick();
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      aria-checked={props.visibility === false ? "false" : "true"}
      aria-labelledby={props.ariaLabelledBy}
      className={`${
        props.visibility !== false
          ? Boolean(props.error)
            ? "bg-gradient-to-b from-red-500 to-red-700"
            : "bg-primary-900"
          : "bg-white border border-gray-300 "
      } w-4 h-4 cursor-pointer flex-inline items-center  ${
        Boolean(props.radio)
          ? `rounded-xl ${props.visibility === true ? "ring-1" : ""}`
          : "rounded"
      } w-4 h-4 relative overflow-hidden focus:outline-none focus:shadow-outline-blue focus:border-blue-300 focus:ring-offset-2 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 ${
        props.disabled
          ? "pointer-events-none border-gray-200 bg-gray-100"
          : "border-gray-300"
      } ${props.className}`}
      style={{
        ...(Boolean(props.error)
          ? { color: "#c54141" }
          : { color: "rgba(50, 100, 245)" }),
        ...(Boolean(props.radio) ? { backgroundImage: "none" } : {}),
      }}
      role="checkbox"
      onClick={props.onClick}
      title={slow ? "Loading slowly..." : undefined}
    >
      <motion.div
        initial={"loaded"}
        variants={{
          loading: {
            opacity: 1,
            transition: {
              delay: 0.2,
            },
          },
          loaded: { opacity: 0 },
        }}
        key="bg-gradient-animation"
        animate={
          (props.loading || DEBUG_SLOW) && props.visibility !== false
            ? "loading"
            : "loaded"
        }
        className={`absolute top-0 left-0 z-10 ${
          (props.loading || DEBUG_SLOW) && props.visibility !== false
            ? "checkbox-loading-animation"
            : ""
        }`}
      />

      <AnimatePresence initial={false}>
        <svg className="w-5 h-4 z-20 absolute" key="svg">
          {!Boolean(props.error) &&
            !Boolean(props.radio) &&
            props.visibility === true &&
            !slow &&
            !DEBUG_SLOW && (
              <motion.path
                key="checkmark"
                initial={{
                  pathLength: 0,
                  opacity: 0,
                }}
                animate={{
                  pathLength: 1,
                  opacity: 1,
                }}
                exit={{
                  opacity: 0,
                }}
                transition={{
                  duration: 0.1,
                }}
                d="M4.5 8l2 2.5L11.5 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                stroke="white"
                fill="transparent"
                strokeWidth="2px"
              />
            )}

          {!Boolean(props.error) &&
            Boolean(props.radio) &&
            props.visibility === true &&
            !slow &&
            !DEBUG_SLOW && (
              <motion.circle
                cx="8"
                cy="8"
                r="3"
                key="radiomark"
                initial={{
                  pathLength: 0,
                  opacity: 0,
                }}
                animate={{
                  pathLength: 1,
                  opacity: 1,
                }}
                exit={{
                  opacity: 0,
                }}
                transition={{
                  duration: 0.1,
                }}
                fill="white"
              />
            )}

          {!Boolean(props.error) &&
            props.visibility === "mixed" &&
            !slow &&
            !DEBUG_SLOW && (
              <path
                key="line"
                d="M5 8l6 0"
                strokeLinecap="round"
                strokeLinejoin="round"
                stroke="white"
                fill="transparent"
                strokeWidth="2px"
              />
            )}

          {props.visibility !== false && (slow || DEBUG_SLOW) && (
            <motion.g
              style={{
                transform: "scale(0.5) translate(4px, 4px)",
              }}
              stroke="white"
              fill="white"
              initial={{ opacity: 0 }}
              // exit={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <circle className="spinner_ZCsl" cx="12" cy="12" r="0" />
              <circle
                className="spinner_ZCsl spinner_gaIW"
                cx="12"
                cy="12"
                r="0"
              />
            </motion.g>
          )}
        </svg>
        {Boolean(props.error) && (
          <motion.div
            initial={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: {
                duration: 0.3,
                delay: 0.1,
              },
            }}
          >
            <XIcon className="w-4 h-4 text-red-50" strokeWidth={3} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(VisibilityCheckboxAnimated);
