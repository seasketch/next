import { Trans } from "react-i18next";
import { Link } from "react-router-dom";

export type TabItem = {
  name: string;
  href: string;
  current: boolean;
  disabled?: boolean;
};

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function Tabs({ tabs }: { tabs: TabItem[] }) {
  return (
    <div>
      <div className="sm:hidden">
        <label htmlFor="tabs" className="sr-only">
          <Trans>Select a tab</Trans>
        </label>
        {/* Use an "onChange" listener to redirect the user to the selected tab URL. */}
        <select
          id="tabs"
          name="tabs"
          className="block w-full focus:ring-primary-500 focus:border-primary-500 border-gray-300 rounded-md"
          defaultValue={tabs.find((tab) => tab.current)!.name}
        >
          {tabs.map((tab) => (
            <option key={tab.name}>{tab.name}</option>
          ))}
        </select>
      </div>
      <div className="hidden sm:block">
        <nav className="flex space-x-4" aria-label="Tabs">
          {tabs.map((tab) => (
            <Link
              aria-disabled={tab.disabled}
              key={tab.name}
              to={tab.href}
              className={classNames(
                tab.current
                  ? "bg-blue-100 text-primary-600"
                  : "text-gray-500 hover:text-gray-700",
                tab.disabled ? "pointer-events-none" : "",
                "px-3 py-2 font-medium text-sm rounded-md"
              )}
              aria-current={tab.current ? "page" : undefined}
            >
              {tab.name}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
