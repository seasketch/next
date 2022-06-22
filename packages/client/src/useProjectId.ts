import useCurrentProjectMetadata from "./useCurrentProjectMetadata";

export default function useProjectId() {
  const { data } = useCurrentProjectMetadata();
  return data?.project?.id;
}
