/* eslint-disable i18next/no-literal-string */
import { ReactNode, useEffect } from "react";
import Spinner from "./Spinner";
import { useRef, useState } from "react";
import { Dialog, Tab } from "@headlessui/react";
import {
  ExclamationCircleIcon,
  ExclamationIcon,
  TrashIcon,
} from "@heroicons/react/outline";
import { motion } from "framer-motion";

export type FooterButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "trash";
  label: string | ReactNode;
  autoFocus?: boolean;
};

interface ModalProps {
  panelClassName?: string;
  onRequestClose: () => void;
  disableBackdropClick?: boolean;
  footer?: FooterButtonProps[];
  title?: string | ReactNode;
  className?: string;
  loading?: boolean;
  children?: ReactNode;
  icon?: "delete" | "alert";
  autoWidth?: boolean;
  tipyTop?: boolean;
  tabs?: string[];
  scrollable?: boolean;
  zeroPadding?: boolean;
  onTabChange?: (selectedIndex: number) => void;
  initialFocus?: any;
  open?: boolean;
  dark?: boolean;
}

export default function Modal(props: ModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (props.scrollable && props.icon) {
    throw new Error("Cannot combine scrollable and icon settings in Modal");
  }

  let grid = `
    [row1-start] "icon header" auto [row1-end]
    [row2-start] "icon body" 1fr [row2-end]
    [row3-start] "icon footer" 25px [row3-end]
    / 50px auto
  `;

  if (props.scrollable) {
    grid = `
      [row1-start] "header" auto [row1-end]
      [row2-start] "body" 1fr [row2-end]
      [row3-start] "footer" auto [row3-end]
      / auto
    `;
  }

  let hasTitle = Boolean(props.title);
  if (props.title && typeof props.title === "string") {
    hasTitle = props.title.length > 0;
  }

  return (
    <Dialog
      open={props.open === undefined ? true : props.open}
      as={motion.div}
      className={`relative ${props.tipyTop ? "z-50" : "z-30"}`}
      onClose={(e) => {
        if (!props.disableBackdropClick) {
          props.onRequestClose();
        }
      }}
      initialFocus={props.initialFocus}
    >
      <Backdrop />

      <div className="fixed z-10 inset-0 overflow-y-auto sm:overflow-y-hidden">
        <Tab.Group
          selectedIndex={selectedIndex}
          onChange={(idx) => {
            setSelectedIndex(idx);
            if (props.onTabChange) {
              props.onTabChange(idx);
            }
          }}
        >
          <div className="flex items-end sm:items-center justify-center min-h-full p-4 text-center sm:p-0">
            {props.loading && (
              <div>
                <Spinner large color="white" />
                <Panel
                  initialFocus={props.initialFocus}
                  zeroPadding={true}
                  autoWidth={true}
                  grid={grid}
                  className="hidden"
                />
              </div>
            )}
            {!props.loading && (
              <Panel
                zeroPadding={props.zeroPadding || false}
                autoWidth={props.autoWidth}
                grid={grid}
                initialFocus={props.initialFocus}
                dark={props.dark}
                className={props.panelClassName}
              >
                <div
                  className={`w-full justify-center ${
                    props.icon && "sm:pl-4 sm:flex sm:items-start"
                  }`}
                >
                  {props.icon && props.icon === "delete" && (
                    <div className="mt-5 mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                      <ExclamationIcon
                        className="h-6 w-6 text-red-600"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                  {props.icon && props.icon === "alert" && (
                    <div className="mt-5 mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-primary-300 bg-opacity-10 sm:mx-0 sm:h-10 sm:w-10">
                      <ExclamationCircleIcon
                        className="h-6 w-6 text-gray-500"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                  <div
                    className={`sm:flex sm:flex-col mt-3 text-center sm:mt-0 ${
                      props.icon && "sm:ml-4"
                    } sm:text-left sm:max-h-almost-full`}
                  >
                    {hasTitle && (
                      <Dialog.Title
                        tabIndex={-1}
                        as="h3"
                        className={`truncate p-6 text-lg leading-6 font-medium text-gray-900 ${
                          props.tabs !== undefined ? "pb-0" : "pb-4"
                        } ${
                          (props.tabs !== undefined || props.scrollable) &&
                          "border-b"
                        } ${props.icon && "pl-0"}`}
                      >
                        {props.title}

                        {props.tabs && props.tabs.length > 0 && (
                          <>
                            <Tabs
                              selectedIndex={selectedIndex}
                              labels={props.tabs}
                              setSelectedIndex={setSelectedIndex}
                            />
                          </>
                        )}
                      </Dialog.Title>
                    )}

                    <div
                      className={`sm:flex-1 mt-0 ${
                        props.zeroPadding ? "" : "p-6"
                      } ${
                        props.scrollable ? "py-4" : "py-0"
                      } sm:overflow-y-auto ${props.icon && "pl-0"}`}
                    >
                      {props.children}
                    </div>
                    {((props.footer && props.footer.length > 0) ||
                      !props.zeroPadding) && (
                      <div
                        className={`${
                          ""
                          // props.icon && "sm:ml-10 sm:pl-4"
                        } sm:flex space-y-2 sm:space-y-0 sm:space-x-2 px-6 py-4 ${
                          props.scrollable && "sm:bg-gray-100"
                        } ${props.icon && "pl-0"}`}
                      >
                        {(props.footer || []).map((footerProps) => (
                          <FooterButton
                            key={footerProps.label!.toString()}
                            {...footerProps}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            )}
          </div>
        </Tab.Group>
      </div>
    </Dialog>
  );
}

function Backdrop() {
  return (
    <motion.div
      style={{ backdropFilter: "blur(4px)" }}
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
  grid,
  zeroPadding,
  initialFocus,
  dark,
  className,
}: {
  children?: ReactNode;
  autoWidth?: boolean;
  grid: string;
  zeroPadding: boolean;
  initialFocus?: React.RefObject<HTMLElement>;
  dark?: boolean;
  className?: string;
}) {
  const myRef = useRef(null);
  return (
    <Dialog.Panel
      ref={myRef}
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
      className={`relative ${
        dark ? "bg-gray-700 text-white" : "bg-white"
      } rounded-lg ${
        zeroPadding ? "" : "px-4"
      } pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-xl lg:max-w-2xl ${
        autoWidth ? "w-auto" : "w-full"
      } sm:p-0 ${className}`}
      onAnimationComplete={() => {
        if (initialFocus && initialFocus.current) {
          initialFocus.current.focus();
        } else if (myRef.current && "querySelectorAll" in myRef.current) {
          const dom = myRef.current as HTMLElement;
          const inputs = dom.querySelectorAll("input");
          if (inputs && inputs.length) {
            for (const input of inputs) {
              if (input.tabIndex !== -1) {
                input.focus();
                return;
              }
            }
          }
          const buttons = dom.querySelectorAll("button");
          if (buttons && buttons.length) {
            buttons[0].focus();
            return;
          }
        }
      }}
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
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (ref.current && props.autoFocus) {
      ref.current.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <button
      tabIndex={0}
      ref={ref}
      autoFocus={props.autoFocus || false}
      type="button"
      className={`${
        props.disabled && "pointer-events-none opacity-50"
      } inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto sm:text-sm ${colors} items-center`}
      onClick={props.onClick}
    >
      {props.variant === "trash" && <TrashIcon className="w-4 h-4 mr-2" />}
      {props.label}
      {props.loading && <Spinner className="ml-2" color="white" />}
    </button>
  );
}

export function Tabs({
  labels,
  selectedIndex,
  setSelectedIndex,
}: {
  labels: string[];
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
}) {
  return (
    <div>
      <div className="sm:hidden">
        <label htmlFor="tabs" className="sr-only">
          Select a tab
        </label>
        {/* Use an "onChange" listener to redirect the user to the selected tab URL. */}
        <select
          id="tabs"
          name="tabs"
          className="mt-3 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          value={selectedIndex.toString()}
          onChange={(e) => setSelectedIndex(parseInt(e.target.value))}
        >
          {labels.map((label, i) => (
            <option value={i.toString()} key={label}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="hidden sm:block">
        <div className=" border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {labels.map((label) => (
              <Tab
                key={label}
                className={classNames(
                  labels.indexOf(label) === selectedIndex
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                  "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
                )}
              >
                {label}
              </Tab>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}
