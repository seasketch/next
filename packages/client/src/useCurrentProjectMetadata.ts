import { FetchPolicy, WatchQueryFetchPolicy } from "@apollo/client";
import { useParams } from "react-router-dom";
import { useProjectMetadataQuery } from "./generated/graphql";

export default function useCurrentProjectMetadata(opts?: {
  fetchPolicy?: FetchPolicy | WatchQueryFetchPolicy;
  onError?: (err: Error) => void;
}) {
  const { slug } = useParams<{ slug: string }>();
  return useProjectMetadataQuery({ variables: { slug } });
}
