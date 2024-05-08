import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createContext, ReactNode, useContext } from "react";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";
import TextInput from "./TextInput";
import Spinner from "./Spinner";

export default function useDialog() {
  const context = useContext(UseDialogContext);
  return useMemo(
    () => ({
      /**
       * @deprecated
       * Hacky thing used to force a re-render of the dialog when providing
       * inputs within a dialog that rely on external state. Use with caution.
       */
      setState: context.setState,
      makeChoice: (options: {
        title: string;
        choices: ReactNode[];
      }): Promise<number | false> => {
        return new Promise((resolve, reject) => {
          context.setState({
            type: "choice",
            message: options.title,
            open: true,
            choices: options.choices,
            onSubmit: (value) => resolve(parseInt(value)),
            onCancel: () => resolve(false),
            submitting: false,
          });
        });
      },
      loadingMessage: (message: string) => {
        context.setState({
          type: "loading",
          open: true,
          message: null,
          submitting: false,
          description: message,
        });
        return {
          hideLoadingMessage: () => {
            context.setState(ResetState);
          },
          updateLoadingMessage: (
            message: string | ReactNode,
            complete?: boolean
          ) => {
            context.setState((prev) => {
              return {
                ...prev,
                open: true,
                type: "loading",
                message: null,
                description: message,
                submitting: complete ? false : true,
              };
            });
          },
        };
      },
      prompt: (options: {
        message: string;
        defaultValue?: string;
        onSubmit: (value: string) => void | Promise<string | void>;
        onCancel?: () => void;
        icon?: "alert" | "delete";
      }) => {
        context.setState({
          type: "prompt",
          open: true,
          message: options.message,
          defaultValue: options.defaultValue,
          onSubmit: options.onSubmit,
          onCancel: options.onCancel,
          submitting: false,
          disableBackdropClick: true,
        });
      },
      alert: (
        message: string | ReactNode,
        options?: {
          description?: string | ReactNode;
        }
      ) => {
        return new Promise((resolve, reject) => {
          context.setState({
            type: "alert",
            open: true,
            message: message,
            description: options?.description,
            onSubmit: resolve,
            submitting: false,
            disableBackdropClick: true,
          });
        });
      },
      confirm: (
        message: string,
        options?: {
          description?: string | ReactNode;
          icon?: "alert" | "delete";
          primaryButtonText?: string;
          secondaryButtonText?: string;
          onSubmit?: (value: string) => void | Promise<string | void>;
        }
      ): Promise<boolean> => {
        return new Promise((resolve, reject) => {
          context.setState({
            type: "confirm",
            open: true,
            description: options?.description,
            message: message,
            onSubmit: options?.onSubmit
              ? options?.onSubmit
              : () => resolve(true),
            onCancel: () => resolve(false),
            submitting: false,
            primaryButtonText: options?.primaryButtonText,
            secondaryButtonText: options?.secondaryButtonText,
          });
        });
      },
      confirmDelete: (options: {
        message: string;
        description?: string | ReactNode;
        onDelete: (value: string) => void | Promise<string | void>;
        onCancel?: () => void;
        primaryButtonText?: string;
      }) => {
        context.setState({
          type: "confirm",
          open: true,
          description: options.description,
          message: options.message,
          onSubmit: options.onDelete,
          onCancel: options.onCancel,
          submitting: false,
          icon: "delete",
          primaryButtonText: options.primaryButtonText || "Delete",
          primaryButtonVariant: "danger",
        });
      },
    }),
    [context]
  );
}

type DialogContextState = {
  type: "prompt" | "alert" | "confirm" | "loading" | "choice";
  open: boolean;
  message: string | ReactNode;
  description?: string | ReactNode;
  defaultValue?: string;
  submitting: boolean;
  onSubmit?: (value: string) => void | Promise<string | void>;
  onCancel?: () => void;
  icon?: "alert" | "delete";
  primaryButtonVariant?: "primary" | "danger";
  primaryButtonText?: string;
  secondaryButtonText?: string;
  disableBackdropClick?: boolean;
  choices?: ReactNode[];
};

const ResetState: DialogContextState = {
  type: "prompt",
  message: "Prompt title",
  open: false,
  submitting: false,
};

const UseDialogContext = createContext<{
  state: DialogContextState;
  setState: Dispatch<SetStateAction<DialogContextState>>;
}>({
  state: ResetState,
  setState: () => {},
});

export function DialogProvider({ children }: { children?: ReactNode }) {
  const { t } = useTranslation("common");
  const [state, setState] = useState<DialogContextState>(ResetState);
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string | undefined>(undefined);

  const reset = useCallback(() => {
    setState(ResetState);
    setValue("");
    setError(undefined);
  }, [setState, setValue, setError]);

  useEffect(() => {
    if (state.defaultValue?.length) {
      setValue(state.defaultValue);
    }
  }, [state.defaultValue]);

  const onSubmit = useCallback(async () => {
    if (state.onSubmit) {
      setState((prev) => ({ ...prev, submitting: true }));
      try {
        await state.onSubmit(value);
        reset();
      } catch (e) {
        setError(e.toString());
        setState((prev) => {
          return {
            ...prev,
            submitting: false,
          };
        });
      }
    }
  }, [state, value, reset]);

  return (
    <UseDialogContext.Provider value={{ state, setState }}>
      {state.open && (
        <Modal
          tipyTop
          zeroPadding={state.type === "loading"}
          icon={state.type === "alert" ? "alert" : state.icon}
          title={state.message}
          onRequestClose={() => {
            if (!state.submitting) {
              reset();
            }
          }}
          disableBackdropClick={state.disableBackdropClick}
          autoWidth
          footer={
            state.type === "loading"
              ? []
              : state.type === "alert"
              ? [
                  {
                    disabled: false,
                    label: state.primaryButtonText || t("OK"),
                    onClick: onSubmit,
                    variant: state.primaryButtonVariant || "primary",
                    loading: false,
                    autoFocus: true,
                  },
                ]
              : state.type === "confirm"
              ? [
                  {
                    disabled: state.submitting,
                    label: state.primaryButtonText || t("OK"),
                    onClick: onSubmit,
                    variant: state.primaryButtonVariant || "primary",
                    loading: state.submitting,
                    autoFocus: true,
                  },
                  {
                    disabled: state.submitting,
                    label: state.secondaryButtonText || t("Cancel"),
                    onClick: () => {
                      if (state.onCancel) {
                        state.onCancel();
                      }
                      reset();
                    },
                  },
                ]
              : state.type === "choice"
              ? [
                  {
                    disabled: state.submitting,
                    label: t("Cancel"),
                    onClick: () => {
                      if (state.onCancel) {
                        state.onCancel();
                      }
                      reset();
                    },
                  },
                ]
              : [
                  {
                    disabled: state.submitting,
                    label: state.primaryButtonText || t("Submit"),
                    onClick: onSubmit,
                    variant: state.primaryButtonVariant || "primary",
                    loading: state.submitting,
                    autoFocus: true,
                  },
                  {
                    disabled: state.submitting,
                    label: t("Cancel"),
                    onClick: () => {
                      if (state.onCancel) {
                        state.onCancel();
                      }
                      reset();
                    },
                  },
                ]
          }
        >
          <div className="">
            {state.type === "loading" && (
              <div className="flex items-center justify-center p-4 space-x-2">
                {state.submitting ? <Spinner /> : ""}
                <div>{state.description}</div>
              </div>
            )}
            {state.type !== "loading" && state.description && (
              <p className="text-gray-500 text-sm">{state.description}</p>
            )}
            {state.choices && state.type === "choice" && (
              <div className="space-y-4">
                {state.choices.map((node, i) => {
                  return (
                    <div
                      key={i}
                      className="cursor-pointer group"
                      onClick={() => {
                        if (state.onSubmit) {
                          state.onSubmit(i.toString());
                        }
                        reset();
                      }}
                    >
                      {node}
                    </div>
                  );
                })}
              </div>
            )}
            {state.type === "prompt" && (
              <TextInput
                name="name"
                autocomplete="off"
                error={error}
                label={""}
                value={value}
                onChange={setValue}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onSubmit();
                    e.preventDefault();
                    e.stopPropagation();
                  } else if (e.key === "Escape" && state.type === "prompt") {
                    if (state.onCancel) {
                      state.onCancel();
                    }
                    reset();
                  }
                }}
              />
            )}
          </div>
        </Modal>
      )}
      {children}
    </UseDialogContext.Provider>
  );
}
