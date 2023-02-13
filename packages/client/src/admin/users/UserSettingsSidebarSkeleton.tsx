import React from "react";
import Skeleton from "../../components/Skeleton";

export default function UserSettingsSidebarSkeleton() {
  return (
    <div className="bg-white h-full max-h-full overflow-y-auto">
      <div className="flex-shrink-0 w-96 max-w-full min-h-full bg-white border-r border-blue-gray-200 flex flex-col">
        <NavItemSkeleton />
        <NavItemSkeleton />
        <Skeleton className="w-full h-8 mt-0" />
        <NavItemSkeleton />
        <NavItemSkeleton />
        <NavItemSkeleton />
        <NavItemSkeleton />
        <Skeleton className="w-full h-8 mt-0" />
        <NavItemSkeleton />
      </div>
    </div>
  );
}

function NavItemSkeleton() {
  return (
    <div className="flex p-5 m-0 border-b border-blue-gray-200">
      <Skeleton className="rounded mb-1 flex-shrink-0 mt-0.5 h-6 w-6 text-blue-gray-400" />
      <div className="ml-3 mb-0 text-sm flex-1 w-44">
        <Skeleton className="rounded mt-1 mb-1 w-32" />
        <Skeleton className="rounded mt-1 mb-1 w-72" />
        <Skeleton className="rounded mt-1 mb-1 w-72" />
      </div>
    </div>
  );
}
