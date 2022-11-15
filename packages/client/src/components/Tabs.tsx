import { Trans } from "react-i18next";
import { Link } from "react-router-dom";

export type TabItem = {
  name: string;
  href: string;
  current: boolean;
  disabled?: boolean;
};

export type NonLinkTabItem = {
  name: string;
  id: string;
  current: boolean;
  disabled?: boolean;
};

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function Tabs({
  tabs,
  onClick,
  small,
  dark,
}: {
  tabs: (TabItem | NonLinkTabItem)[];
  onClick?: (id: string) => void;
  small?: boolean;
  dark?: boolean;
}) {
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
            <TabButton
              dark={dark}
              key={tab.name}
              small={small}
              tab={tab}
              onClick={onClick}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

function isLink(item: TabItem | NonLinkTabItem): item is TabItem {
  return "href" in item;
}

function TabButton({
  tab,
  onClick,
  small,
  dark,
}: {
  tab: TabItem | NonLinkTabItem;
  onClick?: (id: string) => void;
  small?: boolean;
  dark?: boolean;
}) {
  if (isLink(tab)) {
    return (
      <Link
        aria-disabled={tab.disabled}
        to={tab.href}
        className={classNames(
          tab.current
            ? "bg-blue-100 text-primary-600"
            : "text-gray-500 hover:text-gray-700",
          tab.disabled ? "pointer-events-none" : "",
          small ? "px-2 py-1" : "px-2 py-1",
          "font-medium text-sm rounded-md"
        )}
        aria-current={tab.current ? "page" : undefined}
      >
        {tab.name}
      </Link>
    );
  } else {
    return (
      <button
        aria-disabled={tab.disabled}
        onClick={onClick ? () => onClick(tab.id) : undefined}
        className={classNames(
          tab.current
            ? dark
              ? "bg-indigo-100 text-gray-600"
              : "bg-blue-100 text-primary-600"
            : dark
            ? "text-gray-400 hover:text-gray-300"
            : "text-gray-500 hover:text-gray-700",
          tab.disabled ? "pointer-events-none" : "",
          small ? "px-2 py-1" : "px-2 py-1",
          "font-medium text-sm rounded-md"
        )}
      >
        {tab.name}
      </button>
    );
  }
}
