/* eslint-disable react/jsx-no-target-blank */
/* eslint-disable i18next/no-literal-string */

import { Trans } from "react-i18next";

export default function DeveloperApiPage() {
  return (
    <main
      className="bg-gray-800 pt-12"
      style={{ minHeight: "calc(100vh - 64px)" }}
    >
      <div className="mx-auto max-w-screen-xl">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 overflow-x-hidden pb-4">
          <div className="px-4 sm:px-6 sm:text-center md:max-w-2xl md:mx-auto lg:pl-8 lg:col-span-6 lg:text-left lg:flex lg:items-center">
            <div>
              <h2 className="mt-4 text-4xl tracking-tight leading-10 font-extrabold text-white sm:mt-5 sm:leading-none sm:text-6xl lg:mt-6 lg:text-5xl xl:text-6xl">
                <Trans>Developer API</Trans>
              </h2>
              <p className="mt-3 text-base text-gray-300 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                <Trans>
                  SeaSketch projects can be customized using our open-source{" "}
                  <a
                    target="_blank"
                    className="text-primary-300"
                    href="https://github.com/seasketch/geoprocessing"
                    rel="noreferrer"
                  >
                    Geoprocessing Framework
                  </a>
                  . Projects can define reports that visualize the impact of
                  prospective zones using Typescript, React, and AWS Lambda.
                </Trans>
              </p>
            </div>
          </div>
          <div className="bg-gray-900 mt-12 sm:mt-16 lg:mt-0 lg:col-span-6 rounded-xl shadow-2xl transform scale-90 -rotate-2 lg:-rotate-3 ">
            <img
              width={1810}
              height={2320}
              alt="geoprocessing framework code sample"
              src="/geoprocessing-api-code.png"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
