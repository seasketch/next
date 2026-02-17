import React, { ReactNode } from "react";
import { Trans } from "react-i18next";
import Badge from "./Badge";
import Button from "./Button";
import {
  Link,
  NavLink,
  Route,
  Switch,
  useParams,
  useRouteMatch,
} from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Skeleton from "../components/Skeleton";

export interface NavSidebarItem {
  label: string;
  isGroup?: boolean;
  description?: string;
  href?: string;
  icon?: (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
  badge?: string | number;
  badgeVariant?: "secondary" | "primary" | "warning" | "error";
  button?: ReactNode;
  animate?: boolean;
  compact?: boolean;
  className?: string;
}

export interface NavSidebarProps {
  items: NavSidebarItem[];
  className?: string;
  ariaLabel?: string;
  footer?: ReactNode;
  header?: string;
  animate?: boolean;
  loading?: boolean;
  loadingSkeletonItemCount?: number;
  headerButton?: ReactNode;
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function NavSidebar(props: NavSidebarProps) {
  if (props.loading && props.loadingSkeletonItemCount !== undefined) {
    return (
      <NavSkeleton
        header={props.header}
        numItems={props.loadingSkeletonItemCount}
      />
    );
  }
  return (
    <nav
      aria-label={props.ariaLabel}
      className={`flex-shrink-0 w-full lg:w-96 max-w-full max-h-screen overflow-y-auto overscroll-contain min-h-screen bg-white border-r border-blue-gray-200 flex flex-col ${props.className}`}
    >
      {props.header && (
        <div className="hidden md:flex flex-shrink-0 h-16 px-6 border-b border-blue-gray-200 items-center">
          <div className="text-md font-medium text-blue-gray-900 flex w-full">
            {props.header}
          </div>
          {props.headerButton}
        </div>
      )}
      {props.items.map((item) => (
        <NavSidebarItem key={item.label} item={item} animate={props.animate} />
      ))}

      <div className="flex-1 min-h-0">
        {props.footer && (
          <div className={"text-sm flex p-6 py-2"}>{props.footer}</div>
        )}
      </div>
    </nav>
  );
}

function NavSidebarItem({
  item,
  animate,
}: {
  item: NavSidebarItem;
  animate?: boolean;
}) {
  if (item.isGroup) {
    return (
      <div
        key={item.label}
        className={
          "text-sm flex p-6 py-2 bg-cool-gray-50 border-b border-blue-gray-200 justify-center" +
          (item.className || "")
        }
      >
        <span className="flex-1 self-center">{item.label}</span>
        {item.button && (
          <span className="flex-0 self-center -mr-3">{item.button}</span>
        )}
      </div>
    );
  } else {
    // const container = item.href ? Link : ;
    return (
      <NavLink
        key={item.label}
        to={item.href || ""}
        activeClassName="bg-blue-100 bg-opacity-50"
        className={classNames(
          "hover:bg-blue-50 hover:bg-opacity-50",
          "flex border-b border-blue-gray-200",
          item.compact ? "px-3 py-4" : "p-6",
          item.className || ""
        )}
        // aria-current={item.current ? "page" : undefined}
      >
        {item.icon && (
          <item.icon
            className="flex-shrink-0 -mt-0.5 h-6 w-6 text-blue-gray-400"
            aria-hidden="true"
          />
        )}
        <div className="ml-3 text-sm flex-1">
          <p className="font-medium ">{item.label}</p>
          <p className="mt-1 opacity-70">{item.description}</p>
        </div>
        {item.badge !== undefined && (
          <div className="flex flex-col justify-center ml-1">
            {/* <AnimatePresence> */}
            <Badge
              animate={animate}
              key={item.badge}
              className="ml-1"
              /* @ts-ignore */
              variant={item.badgeVariant}
            >
              {item.badge}
            </Badge>
            {/* </AnimatePresence> */}
          </div>
        )}
      </NavLink>
    );
  }
}

function NavSkeleton({
  numItems,
  compact,
  header,
}: {
  numItems: number;
  compact?: boolean;
  header?: string | ReactNode;
}) {
  return (
    <div className="bg-white h-full max-h-full overflow-y-auto min-h-screen">
      <div className="flex-shrink-0 w-96 max-w-full min-h-full bg-white border-r border-blue-gray-200 flex flex-col">
        {header && (
          <div className="hidden md:flex flex-shrink-0 h-16 px-6 border-b border-blue-gray-200 items-center">
            <div className="text-md font-medium text-blue-gray-900 flex w-full">
              {header}
            </div>
          </div>
        )}
        {[...new Array(numItems)].map((_, i) => (
          <NavItemSkeleton compact key={i} />
        ))}
      </div>
    </div>
  );
}

function NavItemSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div
      className={classNames(
        "hover:bg-blue-50 hover:bg-opacity-50",
        "flex border-b border-blue-gray-200",
        compact ? "px-3 py-4" : "p-6"
      )}
    >
      <Skeleton className="rounded mt-1 mb-1 w-52" />
    </div>
  );
}
