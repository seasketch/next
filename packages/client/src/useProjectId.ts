import { useParams, useRouteMatch } from "react-router-dom";
import { useCurrentProjectMetadataQuery } from "./generated/graphql";

export default function useProjectId() {
  const { slug } = useParams<{ slug: string }>();
  let { path } = useRouteMatch();
  const { data } = useCurrentProjectMetadataQuery();
  return data?.currentProject?.id;
}
