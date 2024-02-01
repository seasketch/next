import { QueryResult } from "@apollo/client";
import { TreeItem } from "../components/TreeView";
import { Exact, Maybe, SearchOverlaysQuery } from "../generated/graphql";
import { SearchIcon, XIcon } from "@heroicons/react/outline";
import { XCircleIcon } from "@heroicons/react/solid";
import { Trans } from "react-i18next";

export default function SearchResultsMessages({
  search,
  filteredTreeNodes,
  searchResults,
}: {
  search?: string;
  filteredTreeNodes: TreeItem[];
  searchResults: QueryResult<
    SearchOverlaysQuery,
    Exact<{
      search: string;
      draft?: Maybe<boolean> | undefined;
      limit?: Maybe<number> | undefined;
      projectId: number;
      lang: string;
    }>
  >;
}) {
  return (
    <>
      {search &&
        search.length > 1 &&
        filteredTreeNodes.length === 0 &&
        searchResults.loading &&
        !searchResults.error && (
          <div className="w-72 mx-auto flex items-center space-x-2 text-gray-400 py-12 justify-center">
            <SearchIcon className="w-8 h-8" />
            <div>
              <Trans ns="homepage">Searching for overlays...</Trans>
            </div>
          </div>
        )}
      {search &&
        search.length > 1 &&
        filteredTreeNodes.length === 0 &&
        !searchResults.loading &&
        !searchResults.error && (
          <div className="w-72 mx-auto flex justify-center items-center space-x-2 text-gray-400 py-12">
            {/* <SearchIcon className="w-8 h-8" /> */}
            <XIcon className="w-8 h-8" />
            <div>
              <Trans ns="homepage">No matching overlays found</Trans>
            </div>
          </div>
        )}
      {searchResults.error && (
        <div className="w-72 mx-auto text-red-500 py-12">
          <div className="flex items-center space-x-2">
            <XCircleIcon className="w-8 h-8" />
            <div>
              <Trans ns="homepage">Error searching overlays</Trans>
            </div>
          </div>
          <p className="text-sm mt-2">{searchResults.error.message}</p>
        </div>
      )}
    </>
  );
}
