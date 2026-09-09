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

type ToastOptions = {
  description?: string;
  /** Auto-dismiss delay. Defaults to AUTO_DISMISS_MS. */
  duration?: number;
};

const ToastContext = createContext<{
  toast: (title: string, options?: ToastOptions) => void;
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
  const [duration, setDuration] = useState(AUTO_DISMISS_MS);

  const toast = useCallback((title: string, options?: ToastOptions) => {
    setCurrent({
      id: Date.now(),
      title,
      description: options?.description,
    });
    setDuration(
      typeof options?.duration === "number" ? options.duration : AUTO_DISMISS_MS
    );
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible || !current) {
      return;
    }
    const timeout = setTimeout(() => {
      setVisible(false);
    }, duration);
    return () => {
      clearTimeout(timeout);
    };
  }, [visible, current, duration]);

  const value = useMemo(
    () => ({ toast, current, visible }),
    [toast, current, visible]
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function ToastViewport({ className }: { className?: string }) {
  const { current, visible } = useContext(ToastContext);

  return (
    <div
      aria-live="polite"
      className={
        className ||
        "pointer-events-none absolute bottom-4 right-4 z-20"
      }
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
        <div className="flex w-64 items-start gap-1.5 rounded-md bg-gray-900/90 px-3 py-2 text-white shadow-md">
          <CheckCircleIcon
            className="h-3.5 w-3.5 flex-none text-primary-300 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-xs leading-5">
            <span className="font-medium">{current?.title}</span>
            {current?.description && (
              <span className="mt-0.5 block font-normal text-gray-300">
                {current.description}
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
