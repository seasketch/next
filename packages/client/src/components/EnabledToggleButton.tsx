import { Trans } from "react-i18next";
import Button from "./Button";

export default function EnabledToggleButton({
  enabled,
  onClick,
  small,
}: {
  enabled: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      small={small}
      primary={enabled}
      label={
        <span>
          <input
            onChange={() => {}}
            className="mr-1 cursor-pointer"
            type="checkbox"
            checked={enabled}
          />
          {enabled ? <Trans>Enabled</Trans> : <Trans>Disabled</Trans>}
        </span>
      }
    ></Button>
  );
}
