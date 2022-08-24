/* eslint-disable i18next/no-literal-string */
import { useOnlineState } from "beautiful-react-hooks";
import { CacheSettingCards } from "../offline/ClientCacheSettingsCards";
import useIsSuperuser from "../useIsSuperuser";

export default function CacheSettingsPage() {
  const isSuperuser = useIsSuperuser();
  const online = useOnlineState();
  return (
    // <CenteredCardListLayout>
    <div className="space-y-5">
      {(isSuperuser || !online) && (
        <>
          <CacheSettingCards />
        </>
      )}
    </div>
    // </CenteredCardListLayout>
  );
}
