import { useContext } from "react";
import {
  MapContext,
  MeasurementDigitizingState,
} from "./dataLayers/MapContextManager";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

export default function MeasurementToolsOverlay({
  placement,
}: {
  placement: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}) {
  const mapContext = useContext(MapContext);
  const { state, digitizingState } = mapContext.measurementToolsState;
  const { t } = useTranslation("homepage");
  return (
    <AnimatePresence>
      {state && state === "active" && (
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.5,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            scale: 0,
          }}
          transition={{
            duration: 0.15,
          }}
          className={`${
            placement === "top-right" ? "right-20" : "left-20"
          } top-3 absolute z-10 bg-white shadow rounded border p-2`}
        >
          <p>
            {digitizingState === MeasurementDigitizingState.Empty &&
              t("Click on the map to start measuring.")}
          </p>
          <p>
            {digitizingState === MeasurementDigitizingState.Started &&
              t("Double-click to finish measuring or click to draw a path.")}
          </p>
          <select className="p-1 text-xs pr-8 rounded">
            <option value="km">{t("KM")}</option>
          </select>
          <button
            onClick={() => {
              if (mapContext.manager) {
                mapContext.manager.cancelMeasurement();
              }
            }}
            disabled={digitizingState === MeasurementDigitizingState.Empty}
            className="border text-sm"
          >
            {t("Reset")}
          </button>
          <button
            onClick={() => {
              if (mapContext.manager) {
                mapContext.manager.cancelMeasurement();
              }
            }}
            className="border text-sm"
          >
            {t("Close")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
