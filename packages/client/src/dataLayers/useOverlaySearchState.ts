import { useEffect, useState } from "react";
import { TreeItem, TreeItemHighlights } from "../components/TreeView";
import useDebounce from "../useDebounce";
import useCurrentLang from "../useCurrentLang";
import { useSearchOverlaysQuery } from "../generated/graphql";

export default function useOverlaySearchState({
  isDraft,
  projectId,
  treeNodes,
  setExpandedIds,
  expandedIds,
}: {
  isDraft?: boolean;
  projectId?: number;
  treeNodes: TreeItem[];
  setExpandedIds: (val: string[] | ((prev: string[]) => string[])) => void;
  expandedIds: string[];
}) {
  const [search, setSearch] = useState<string>();
  const debouncedSearch = useDebounce(search, 100);
  const currentLanguage = useCurrentLang();
  const searchResults = useSearchOverlaysQuery({
    skip: !projectId || (debouncedSearch ? debouncedSearch.length < 2 : true),
    variables: {
      projectId: projectId || 0,
      search: debouncedSearch || "",
      lang: currentLanguage.code,
      draft: isDraft,
      limit: 100,
    },
    fetchPolicy: "network-only",
  });
  const [previousSearchTerm, setPreviousSearchTerm] = useState(search);
  useEffect(() => {
    if (searchResults.data && searchResults.variables?.search.length) {
      setPreviousSearchTerm(searchResults.variables.search);
    }
  }, [searchResults.data, searchResults.variables?.search]);
  // When filtering tree, the expansion state of items is temporarily updated
  // to ensure that all highlighted items are visible. This state is reset
  // when the filter is cleared. To do this, we need to keep track of the
  // original state of the tree, as well as the user's changes to the tree.
  // When the search filter is cleared, we want to reset the tree to its
  // original state, but we also want to preserve any user changes to the
  // expansion state.
  const [searchState, setSearchState] = useState<{
    originalState?: string[];
    highlights?: { [id: string]: TreeItemHighlights };
  }>({});

  const [filteredTreeNodes, setFilteredTreeNodes] = useState(treeNodes);

  useEffect(() => {
    if (search?.length === 0) {
      if (searchState.originalState) {
        setExpandedIds(searchState.originalState);
        setSearchState((prev) => {
          return {
            ...prev,
            originalState: undefined,
            highlights: undefined,
          };
        });
      }
    } else if (!searchState.originalState) {
      setSearchState((prev) => {
        return {
          ...prev,
          originalState: [...expandedIds],
        };
      });
    }
  }, [search?.length]);

  useEffect(() => {
    if (!search?.length) {
      setFilteredTreeNodes(treeNodes);
    } else {
      const highlights: { [id: string]: TreeItemHighlights } = {};
      const newExpandedIds = new Set<string>();
      const addedNodes = new Set<string>();
      const filteredNodes: typeof treeNodes = [];
      const addChildren = (parent: TreeItem) => {
        for (const child of treeNodes.filter((n) => n.parentId === parent.id)) {
          if (!addedNodes.has(child.id)) {
            add(child);
            if (!child.isLeaf) {
              addChildren(child);
            }
          }
        }
      };
      const add = (node: TreeItem) => {
        filteredNodes.push(node);
        addedNodes.add(node.id);
      };
      const addParents = (node: TreeItem) => {
        if (node.parentId && !addedNodes.has(node.parentId)) {
          const parent = treeNodes.find((n) => n.id === node.parentId);
          if (parent) {
            if (!parent.isLeaf) {
              newExpandedIds.add(parent.id);
            }
            add(parent);
            addParents(parent);
          }
        }
      };
      let overlays = searchResults.data?.searchOverlays || [];
      if (
        searchResults.loading &&
        previousSearchTerm &&
        (search.indexOf(previousSearchTerm) === 0 ||
          previousSearchTerm.indexOf(search) === 0) &&
        searchResults.previousData?.searchOverlays
      ) {
        overlays = searchResults.previousData.searchOverlays;
      }
      for (const result of overlays) {
        const node = treeNodes.find((node) => node.id === result.stableId);
        if (node) {
          highlights[node.id] = {
            title:
              result.titleHeadline && result.titleHeadline.indexOf("<<") !== -1
                ? result.titleHeadline
                : undefined,
            metadata:
              result.metadataHeadline &&
              result.metadataHeadline.indexOf("<<") !== -1
                ? result.metadataHeadline
                : undefined,
          };
        }
        if (node && filteredNodes.indexOf(node) === -1) {
          add(node);
          // if node is a child, add its parent
          addParents(node);
        }
        if (node && !node.isLeaf) {
          addChildren(node);
        }
      }
      setSearchState((prev) => {
        return {
          ...prev,
          highlights,
        };
      });
      setExpandedIds([...newExpandedIds]);
      setFilteredTreeNodes(filteredNodes);
    }
  }, [treeNodes, searchResults.data, search?.length]);

  const isFiltered = filteredTreeNodes.length !== treeNodes.length;
  const searching = Boolean(
    searchResults.loading ||
      (searchResults.called &&
        search !== undefined &&
        search.length > 1 &&
        searchResults.variables?.search !== search)
  );

  return {
    search,
    setSearch,
    searchResults,
    filteredTreeNodes,
    searchState,
    isFiltered,
    searching,
  };
}
