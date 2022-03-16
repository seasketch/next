import { useParams, useRouteMatch } from "react-router-dom";
import useCurrentProjectMetadata from "./useCurrentProjectMetadata";

export default function useProjectId() {
  let { path } = useRouteMatch();
  const { data } = useCurrentProjectMetadata();
  return data?.project?.id;
}
