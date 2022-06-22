import { useUserIsSuperuserQuery } from "./generated/graphql";

export default function useIsSuperuser() {
  const { data } = useUserIsSuperuserQuery();
  return data?.currentUserIsSuperuser;
}
