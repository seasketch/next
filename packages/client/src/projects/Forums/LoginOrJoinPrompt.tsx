import { useAuth0 } from "@auth0/auth0-react";
import { Trans } from "react-i18next";
import JoinProjectPrompt from "../../auth/JoinProjectPrompt";
import Warning from "../../components/Warning";
import {
  ParticipationStatus,
  useProjectMetadataQuery,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import SignInPrompt from "./SignInPrompt";

export default function LoginOrJoinPrompt({
  className,
  canPost,
}: {
  className?: string;
  canPost?: boolean;
}) {
  const { user } = useAuth0();
  const { data, loading } = useProjectMetadataQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const containerClassName = `${className}`;

  if (canPost) {
    return null;
  } else {
    if (user && (data?.me || loading)) {
      if (!data?.project?.sessionParticipationStatus) {
        return null;
      } else {
        switch (data.project.sessionParticipationStatus) {
          case ParticipationStatus.None:
            return (
              <div className={containerClassName}>
                <JoinProjectPrompt variant="forums" />
              </div>
            );
          case ParticipationStatus.ParticipantSharedProfile:
            return null;
          case ParticipationStatus.PendingApproval:
            return (
              <div className={containerClassName}>
                <Warning level="info">
                  <Trans ns="forums">
                    Your participation in the forum is pending admin approval.
                  </Trans>
                </Warning>
              </div>
            );
          case ParticipationStatus.ParticipantHiddenProfile:
            return (
              <div className={containerClassName}>
                <JoinProjectPrompt variant="forums" />
              </div>
            );
          default:
            return null;
        }
      }
    } else {
      return (
        <div className={containerClassName}>
          <SignInPrompt />
        </div>
      );
    }
  }
}
