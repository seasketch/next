/* eslint-disable i18next/no-literal-string */
import { ReactNode } from "react";
import Spinner from "./Spinner";
import { Fragment, useRef, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  ExclamationCircleIcon,
  ExclamationIcon,
} from "@heroicons/react/outline";
import { AnimatePresence, motion } from "framer-motion";

type FooterButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  label: string | ReactNode;
};

interface ModalProps {
  onRequestClose: () => void;
  disableBackdropClick?: boolean;
  footer?: FooterButtonProps[];
  title: string | ReactNode;
  className?: string;
  loading?: boolean;
  children?: ReactNode;
  description?: string;
  icon?: "delete" | "alert";
  autoWidth?: boolean;
  tipyTop?: boolean;
}

export default function Modal(props: ModalProps) {
  return (
    <Dialog
      open={true}
      as={motion.div}
      className={`relative ${props.tipyTop ? "z-50" : "z-20"}`}
      onClose={props.onRequestClose}
    >
      <Backdrop />
      <div className="fixed z-10 inset-0 overflow-y-auto">
        <div className="flex items-end sm:items-center justify-center min-h-full p-4 text-center sm:p-0">
          <Panel autoWidth={props.autoWidth}>
            <div className="sm:flex sm:items-start">
              {props.icon && props.icon === "delete" && (
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <ExclamationIcon
                    className="h-6 w-6 text-red-600"
                    aria-hidden="true"
                  />
                </div>
              )}
              {props.icon && props.icon === "alert" && (
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-primary-300 bg-opacity-10 sm:mx-0 sm:h-10 sm:w-10">
                  <ExclamationCircleIcon
                    className="h-6 w-6 text-gray-500"
                    aria-hidden="true"
                  />
                </div>
              )}
              <div
                className={`mt-3 text-center sm:mt-0 ${
                  props.icon && "sm:ml-4"
                } sm:text-left`}
              >
                <Dialog.Title
                  as="h3"
                  className="text-lg leading-6 font-medium text-gray-900 pb-1"
                >
                  {props.title}
                </Dialog.Title>

                {props.description && (
                  <Dialog.Description>{props.description}</Dialog.Description>
                )}
                <div className="mt-2">
                  {props.children}
                  {/* <p className="text-sm text-gray-500">
                    Are you sure you want to deactivate your account? All of
                    your data will be permanently removed from our servers
                    forever. This action cannot be undone.
                  </p> */}
                </div>
              </div>
            </div>
            <div
              className={`mt-5 sm:mt-4 ${
                props.icon && "sm:ml-10 sm:pl-4"
              } sm:flex space-y-2 sm:space-y-0 sm:space-x-2`}
            >
              {(props.footer || []).map((footerProps) => (
                <FooterButton
                  key={footerProps.label!.toString()}
                  {...footerProps}
                />
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </Dialog>
  );
}

function Backdrop() {
  return (
    <motion.div
      className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
      variants={{
        enter: {
          opacity: 1,
          transition: {
            duration: 0.1,
            ease: "easeIn",
            delay: 0,
          },
        },
        // Not sure why animating removal doesn't work
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
      exit="exit"
    ></motion.div>
  );
}

function Panel({
  children,
  autoWidth,
}: {
  children?: ReactNode;
  autoWidth?: boolean;
}) {
  return (
    <Dialog.Panel
      as={motion.div}
      variants={{
        enter: {
          scale: 1,
          opacity: 1,
          transition: {
            duration: 0.1,
            ease: "easeIn",
            delay: 0.05,
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
      className={`relative bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-xl lg:max-w-2xl ${
        autoWidth ? "w-auto" : "w-full"
      } sm:p-6`}
    >
      {children}
    </Dialog.Panel>
  );
}

const deleteColors =
  "border-transparent bg-red-600 text-white hover:bg-red-700 focus:ring-red-500";

const secondaryColors =
  "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-primary-500";

const primaryColors =
  "shadow border-transparent bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500";

function FooterButton(props: FooterButtonProps) {
  let colors = secondaryColors;
  if (props.variant) {
    colors =
      props.variant === "primary"
        ? primaryColors
        : props.variant === "danger"
        ? deleteColors
        : secondaryColors;
  }
  return (
    <button
      type="button"
      className={`${
        props.disabled && "pointer-events-none opacity-50"
      } inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto sm:text-sm ${colors}`}
      onClick={props.onClick}
    >
      {props.label}
      {props.loading && <Spinner className="ml-2" color="white" />}
    </button>
  );
}
