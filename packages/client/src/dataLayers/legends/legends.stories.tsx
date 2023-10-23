import { Story } from "@storybook/react/types-6-0";
import Legend from "../Legend";
import { testCases } from "./legendKitchenSinkTestCases";
import {
  SeaSketchGlLayer,
  compileLegendFromGLStyleLayers,
} from "./compileLegend";

const defaultArgs = {
  zOrder: {},
  opacity: {},
  hiddenItems: [],
};

export default {
  title: "Legends",
  component: Legend,
  args: {
    zOrder: {},
    opacity: {},
    hiddenItems: [],
  },
};

export const Legends = () => {
  return (
    <div className="p-4">
      <ul className="flex">
        {Object.keys(testCases).map((testCaseName) => {
          const data = compileLegendFromGLStyleLayers(
            // @ts-ignore
            testCases[testCaseName].input as SeaSketchGlLayer[],
            "vector"
          );
          console.log(data);
          return (
            <div key={testCaseName} className="p-2">
              {/* <h3>{testCaseName}</h3> */}
              {/* @ts-ignore */}
              <Legend
                {...defaultArgs}
                items={[
                  {
                    id: testCaseName,
                    label: testCaseName,
                    type: "GLStyleLegendItem",
                    legend: data,
                  },
                ]}
                maxHeight={600}
              />
            </div>
          );
        })}
      </ul>
    </div>
  );
};
