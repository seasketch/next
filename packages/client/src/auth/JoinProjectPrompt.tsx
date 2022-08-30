import { Trans } from "react-i18next";
import Button from "../components/Button";
import Warning from "../components/Warning";
import {
  ParticipationStatus,
  useProjectMetadataQuery,
} from "../generated/graphql";
import getSlug from "../getSlug";

export default function JoinProjectPrompt(props: { variant?: "forums" }) {
  const slug = getSlug();
  const { data, loading, error } = useProjectMetadataQuery({
    variables: {
      slug,
    },
  });
  if (
    loading ||
    error ||
    data?.project?.sessionParticipationStatus ===
      ParticipationStatus.ParticipantSharedProfile
  ) {
    return null;
  }

  let text = (
    <Trans>
      Consider sharing a user profile and joining this project so you can gain
      access to additional features and data layers.
    </Trans>
  );
  if (props.variant && props.variant === "forums") {
    text = (
      <Trans>
        Consider sharing a user profile and joining this project so you can gain
        access to the discussion forums.
      </Trans>
    );
  }

  return (
    <Warning level="info">
      {text}
      <br />
      <Button
        href={`/${slug}/join?redirectUrl=${window.location.pathname}`}
        small
        className="mt-2"
        label={<Trans>Join Project</Trans>}
      />
    </Warning>
  );
}
