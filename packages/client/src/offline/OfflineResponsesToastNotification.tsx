/* This example requires Tailwind CSS v2.0+ */
import { Fragment, useContext, useEffect, useState } from "react";
import { Transition } from "@headlessui/react";
import { StatusOfflineIcon } from "@heroicons/react/outline";
import { XIcon } from "@heroicons/react/solid";
import { Trans } from "react-i18next";
import { Link } from "react-router-dom";
import { OfflineStateContext } from "./OfflineStateContext";
import useOfflineSurveyResponses from "./useOfflineSurveyResponses";

export default function OfflineResponsesToastNotification() {
  const [dismissed, setDismissed] = useState(false);
  const { online } = useContext(OfflineStateContext);
  const { responses } = useOfflineSurveyResponses();

  if (responses.length === 0 || !online) {
    return null;
  }

  return (
    <>
      <div
        aria-live="assertive"
        className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start"
      >
        <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
          <Transition
            show={!dismissed}
            as={Fragment}
            enter="transform ease-out duration-300 transition"
            enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
            enterTo="translate-y-0 opacity-100 sm:translate-x-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 flex items-center">
                    <StatusOfflineIcon
                      className="h-6 w-6 text-gray-400"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="ml-3 w-0 flex-1 pt-0.5">
                    <p className="text-sm font-medium text-gray-900">
                      <Trans ns="offline">Pending Survey Responses</Trans>
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      <Trans ns="offline">
                        You have offline survey responses waiting to be
                        submitted
                      </Trans>
                    </p>
                    <div className="mt-3 flex space-x-7">
                      <Link
                        to="/submit-offline-surveys"
                        type="button"
                        className="bg-white rounded-md text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <Trans ns="offline">Submit responses now</Trans>
                      </Link>
                      <button
                        type="button"
                        className="bg-white rounded-md text-sm font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        onClick={() => {
                          setDismissed(true);
                        }}
                      >
                        <Trans ns="offline">Dismiss</Trans>
                      </button>
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex">
                    <button
                      type="button"
                      className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      onClick={() => {
                        setDismissed(true);
                      }}
                    >
                      <span className="sr-only">
                        <Trans ns="offline">Close</Trans>
                      </span>
                      <XIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </>
  );
}
