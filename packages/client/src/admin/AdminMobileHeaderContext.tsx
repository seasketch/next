import React, { Dispatch, SetStateAction, useContext } from "react";
import { Link, NavLink } from "react-router-dom";

export interface AdminMobileHeaderState {
  heading?: string;
  backHref?: string;
}

// Dispatch<SetStateAction<AdminMobileHeaderState>>
export const AdminMobileHeaderContext = React.createContext<
  AdminMobileHeaderState & {
    setState: Dispatch<SetStateAction<AdminMobileHeaderState>>;
  }
>({
  setState: () => {},
});

export default function AdminMobileHeader({
  onOpenSidebar,
}: {
  onOpenSidebar: () => void;
}) {
  const { heading, backHref, setState } = useContext(AdminMobileHeaderContext);
  return (
    <div className="fixed w-full z-10 flex-shrink-0 flex md:hidden h-12 bg-white shadow">
      <button
        onClick={onOpenSidebar}
        className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:bg-gray-100 focus:text-gray-600 md:hidden"
        aria-label="Open sidebar"
      >
        <svg
          className="h-6 w-6"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 6h16M4 12h16M4 18h7"
          />
        </svg>
      </button>
      <div className="flex-1 px-4 flex justify-between">
        <div className="flex-1 flex">
          <nav className="flex items-center text-sm leading-5 font-medium">
            {heading && backHref && (
              <Link
                to={backHref}
                className="text-gray-500 hover:text-gray-700 transition duration-150 ease-in-out text-sm mr-2 sm:mr-0"
              >
                {heading}
              </Link>
            )}
            {heading && !backHref && (
              <span className="text-gray-500 hover:text-gray-700 transition duration-150 ease-in-out text-sm mr-2 sm:mr-0">
                {heading}
              </span>
            )}
            {/* {breadcrumbs.length === 0 && (
              <span className="text-gray-500 hover:text-gray-700 transition duration-150 ease-in-out">
                <Trans ns={["admin"]}>Settings</Trans>
              </span>
            )}
            {breadcrumbs.map((b, i) => {
              return (
                <div key={b.key}>
                  <NavLink
                    activeStyle={{ pointerEvents: "none" }}
                    // isActive={b.match.url === }
                    exact
                    to={b.match.url}
                    className="text-gray-500 hover:text-gray-700 transition duration-150 ease-in-out text-sm mr-2 sm:mr-0"
                  >
                    {b.breadcrumb}
                  </NavLink>
                  {i < breadcrumbs.length - 1 && (
                    <svg
                      className="hidden flex-shrink-0 sm:inline -mt-0.5 mx-2 h-5 w-5 text-gray-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              );
            })} */}
          </nav>
        </div>
      </div>
    </div>
  );
}
