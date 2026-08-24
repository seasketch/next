import {
  Fragment,
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Transition } from "@headlessui/react";
import { CheckCircleIcon } from "@heroicons/react/outline";

type ToastItem = {
  id: number;
  title: string;
  description?: string;
};

const AUTO_DISMISS_MS = 1200;

const ToastContext = createContext<{
  toast: (title: string, options?: { description?: string }) => void;
  current: ToastItem | null;
  visible: boolean;
}>({
  toast: () => {},
  current: null,
  visible: false,
});

export function ToastProvider({ children }: { children?: ReactNode }) {
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const [visible, setVisible] = useState(false);

  const toast = useCallback(
    (title: string, options?: { description?: string }) => {
      setCurrent({
        id: Date.now(),
        title,
        description: options?.description,
      });
      setVisible(true);
    },
    []
  );

  useEffect(() => {
    if (!visible || !current) {
      return;
    }
    const timeout = setTimeout(() => {
      setVisible(false);
    }, AUTO_DISMISS_MS);
    return () => {
      clearTimeout(timeout);
    };
  }, [visible, current]);

  const value = useMemo(
    () => ({ toast, current, visible }),
    [toast, current, visible]
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function ToastViewport() {
  const { current, visible } = useContext(ToastContext);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute bottom-4 right-4 z-20"
    >
      <Transition
        show={visible && Boolean(current)}
        as={Fragment}
        enter="transform ease-out duration-150 transition"
        enterFrom="translate-y-1 opacity-0"
        enterTo="translate-y-0 opacity-100"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="flex max-w-xs items-center gap-1.5 rounded-full bg-gray-900/90 px-2.5 py-1 text-white shadow-md">
          <CheckCircleIcon
            className="h-3.5 w-3.5 flex-none text-primary-300"
            aria-hidden="true"
          />
          <p className="truncate text-xs leading-5">
            <span className="font-medium">{current?.title}</span>
            {current?.description && (
              <span className="font-normal text-gray-300">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                {` · ${current.description}`}
              </span>
            )}
          </p>
        </div>
      </Transition>
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
