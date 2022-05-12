import { Trans } from "react-i18next";
import Button from "../components/Button";
import CenteredCardListLayout, {
  Card,
  Header,
} from "../components/CenteredCardListLayout";
import InputBlock from "../components/InputBlock";
import Spinner from "../components/Spinner";
import Switch from "../components/Switch";
import OfflineCacheStatus from "../offline/OfflineCacheStatus";
import useIsSuperuser from "../useIsSuperuser";
import useStaticAssetCache from "../useStaticAssetCache";

export default function AccountSettingsPage() {
  const isSuperuser = useIsSuperuser();
  return (
    <CenteredCardListLayout>
      {isSuperuser && (
        <>
          <Header>
            <Trans ns="superuser">Superuser Client Settings</Trans>
          </Header>
          <Card>
            <OfflineCacheStatus />
          </Card>
        </>
      )}
    </CenteredCardListLayout>
  );
}
