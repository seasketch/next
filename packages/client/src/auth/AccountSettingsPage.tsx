import { useOnlineState } from "beautiful-react-hooks";
import { Trans } from "react-i18next";
import CenteredCardListLayout, {
  Card,
  Header,
} from "../components/CenteredCardListLayout";
import OfflineCacheStatus from "../offline/OfflineCacheStatus";
import useIsSuperuser from "../useIsSuperuser";

export default function AccountSettingsPage() {
  const isSuperuser = useIsSuperuser();
  const online = useOnlineState();
  return (
    <CenteredCardListLayout>
      {(isSuperuser || !online) && (
        <>
          <Header>
            {online ? (
              <Trans ns="superuser">Superuser Client Settings</Trans>
            ) : (
              <Trans>Client Settings</Trans>
            )}
          </Header>
          <Card>
            <OfflineCacheStatus />
          </Card>
        </>
      )}
    </CenteredCardListLayout>
  );
}
