import { useCallback, useEffect, useState } from "react";
import { createContext, ReactNode, useContext } from "react";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";
import TextInput from "./TextInput";

export default function useDialog() {
  const context = useContext(UseDialogContext);
  return {
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
      });
    },
    alert: (
      message: string,
      options?: {
        description?: string;
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
        });
      });
    },
    confirm: (
      message: string,
      options?: {
        description?: string;
        icon?: "alert" | "delete";
      }
    ) => {
      return new Promise((resolve, reject) => {
        context.setState({
          type: "confirm",
          open: true,
          description: options?.description,
          message: message,
          onSubmit: () => resolve(true),
          onCancel: () => resolve(false),
          submitting: false,
        });
      });
    },
    confirmDelete: (options: {
      message: string;
      description?: string;
      onDelete: (value: string) => void | Promise<string | void>;
      onCancel?: () => void;
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
        primaryButtonText: "Delete",
        primaryButtonVariant: "danger",
      });
    },
  };
}

type DialogContextState = {
  type: "prompt" | "alert" | "confirm";
  open: boolean;
  message: string;
  description?: string;
  defaultValue?: string;
  submitting: boolean;
  onSubmit?: (value: string) => void | Promise<string | void>;
  onCancel?: () => void;
  icon?: "alert" | "delete";
  primaryButtonVariant?: "primary" | "danger";
  primaryButtonText?: string;
};

const ResetState: DialogContextState = {
  type: "prompt",
  message: "Prompt title",
  open: false,
  submitting: false,
};

const UseDialogContext = createContext<{
  state: DialogContextState;
  setState: (state: DialogContextState) => void;
}>({
  state: ResetState,
  setState: () => {},
});

export function DialogProvider({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
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
          icon={state.type === "alert" ? "alert" : state.icon}
          title={state.message}
          onRequestClose={() => {
            if (!state.submitting) {
              reset();
            }
          }}
          autoWidth
          footer={
            state.type === "alert"
              ? [
                  {
                    disabled: false,
                    label: state.primaryButtonText || t("OK"),
                    onClick: onSubmit,
                    variant: state.primaryButtonVariant || "primary",
                    loading: false,
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
              : [
                  {
                    disabled: state.submitting,
                    label: state.primaryButtonText || t("Submit"),
                    onClick: onSubmit,
                    variant: state.primaryButtonVariant || "primary",
                    loading: state.submitting,
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
            {state.description && (
              <p className="text-gray-500 text-sm">{state.description}</p>
            )}
            {state.type === "prompt" && (
              <TextInput
                name="name"
                error={error}
                label={t("")}
                value={value}
                onChange={setValue}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onSubmit();
                    e.preventDefault();
                    e.stopPropagation();
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
