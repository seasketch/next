import { AnimatePresence, motion } from "framer-motion";
import React, { useContext } from "react";
import { Trans } from "react-i18next";
import Button from "./Button";

export default function GlobalErrorHandler() {
  const { error, setError } = useContext(GlobalErrorHandlerContext);
  return (
    <div className="absolute top-0 w-screen flex justify-center mt-2 z-50">
      <AnimatePresence>
        {error && (
          <motion.div
            transition={{ duration: 0.5 }}
            initial={{
              opacity: 0,
              y: -200,
            }}
            animate={{ y: 0, opacity: 1 }}
            exit={{
              opacity: 0,
              y: -200,
            }}
            className="bg-white p-4 rounded shadow flex space-x-2 border-l-4 rounded-l-none border-red-600"
          >
            <div className="align-middle">{error.toString()}</div>
            <div>
              <Button
                small
                label={<Trans>dismiss</Trans>}
                onClick={() => setError(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface GlobalErrorHandlerState {
  error: Error | null;
  setError: (error: Error | null) => void;
}

export const GlobalErrorHandlerContext = React.createContext<
  GlobalErrorHandlerState
>({
  error: null,
  setError: () => null,
});

export function useGlobalErrorHandler() {
  const context = useContext(GlobalErrorHandlerContext);
  return context.setError;
}
