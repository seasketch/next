import React, { ReactElement, ReactNode, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface ModalProps {
  open: boolean;
  onRequestClose?: () => void;
  disableEscapeKeyDown?: boolean;
  disableBackdropClick?: boolean;
  footer?: ReactNode;
  title?: string | ReactNode;
  className?: string;
  zeroPadding?: boolean;
}

const Modal: React.FunctionComponent<ModalProps> = ({
  open,
  children,
  disableBackdropClick,
  disableEscapeKeyDown,
  onRequestClose,
  footer,
  title,
  className,
  zeroPadding,
}) => {
  return (
    // <AnimatePresence>
    <div>
      {open && (
        <div className={`fixed z-50 inset-0 overflow-y-hidden h-screen`}>
          <div className="flex items-end justify-center h-screen sm:px-4 sm:pb-20 text-center sm:block sm:p-0">
            <motion.div
              className="fixed inset-0"
              variants={{
                enter: {
                  opacity: 1,
                  transition: {
                    duration: 0.1,
                    ease: "easeIn",
                    delay: 0,
                  },
                },
                exit: {
                  opacity: 0,
                  transition: {
                    duration: 0.2,
                    ease: "easeOut",
                    delay: 0.1,
                  },
                },
              }}
              initial={{ opacity: 0 }}
              animate="enter"
              // transition={{ duration: 0.1, ease: "easeInOut" }}
              exit="exit"
            >
              <div
                onClick={() => {
                  if (!disableBackdropClick) {
                    if (onRequestClose) {
                      onRequestClose();
                    }
                  }
                }}
                className="absolute inset-0 bg-gray-500 opacity-75"
              ></div>
            </motion.div>
            {/* <!-- This element is to trick the browser into centering the modal contents. --> */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen"></span>
            &#8203;
            <motion.div
              className={`inline-block align-bottom overflow-hidden bg-white sm:rounded-lg  text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm md:max-w-full md:w-auto sm:w-full z-50 relative ${
                className ? className : ""
              }`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-headline"
              variants={{
                enter: {
                  scale: 1,
                  opacity: 1,
                  transition: {
                    duration: 0.1,
                    ease: "easeIn",
                    delay: 0.0,
                  },
                },
                exit: {
                  scale: 0.5,
                  opacity: 0,
                  transition: {
                    ease: "easeOut",
                    delay: 0,
                    duration: 0.1,
                  },
                },
              }}
              initial={{ scale: 0.5, opacity: 0 }}
              animate="enter"
              exit="exit"
            >
              <div className="flex flex-col max-h-full">
                {title && (
                  <div
                    className={`w-full text-lg ${
                      typeof title === "string" ? "p-6" : ""
                    } flex-0 border-b`}
                  >
                    {title}
                  </div>
                )}
                <div
                  className={`${
                    zeroPadding ? "p-0" : "p-4 sm:p-6"
                  } flex-1 overflow-y-scroll`}
                >
                  {children}
                </div>
                {footer && (
                  <div className="w-full flex-0 self-end bg-cool-gray-50 p-4 text-left">
                    {footer}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </div>
    // </AnimatePresence>
  );
};

export default Modal;
