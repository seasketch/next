import { useEffect, useCallback, useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import ProfileAvatarUploader from "../components/ProfileAvatarUploader";
import TextInput from "../components/TextInput";
import {
  useMyProfileQuery,
  useUpdateProfileMutation,
} from "../generated/graphql";

type ProfileProps = {
  fullname?: string;
  nickname?: string;
  email?: string;
  affiliations?: string;
};

interface UserProfileFormProps {
  state: ProfileProps;
  onChange: (
    state: ProfileProps,
    /** Would likely only be due to fullname being empty */
    hasValidationError: boolean
  ) => void;
  showValidationErrors: boolean;
}

function validateProps(
  state: ProfileProps,
  t: (s: string, opts?: { ns: string }) => string
) {
  let errors: { fullname?: string } = {};
  if (!state.fullname || state.fullname.length < 1) {
    errors.fullname = t("Required", { ns: "userProfile" });
  }
  return errors;
}

export default function UserProfileForm(props: UserProfileFormProps) {
  const { t } = useTranslation("userProfile");

  const onChange = useCallback(
    (fn: (prev: ProfileProps) => ProfileProps) => {
      const newProps = fn(props.state);
      const errors = validateProps(newProps, t);
      props.onChange(newProps, Object.keys(errors).length > 0);
    },
    [props, t]
  );

  const errors = useMemo(() => validateProps(props.state, t), [props.state, t]);

  return (
    <div className="space-y-3">
      <TextInput
        required
        name="fullname"
        onChange={(fullname) => onChange((prev) => ({ ...prev, fullname }))}
        error={props.showValidationErrors ? errors.fullname : undefined}
        value={props.state.fullname || ""}
        label={<Trans ns="userProfile">Full Name</Trans>}
      />
      <TextInput
        name="nickname"
        onChange={(nickname) => onChange((prev) => ({ ...prev, nickname }))}
        value={props.state.nickname || ""}
        label={<Trans ns="userProfile">Nickname</Trans>}
        description={
          <Trans ns="userProfile">
            Shown as your primary username in discussion forums if provided.
          </Trans>
        }
      />
      <TextInput
        name="email"
        onChange={(email) => onChange((prev) => ({ ...prev, email }))}
        value={props.state.email || ""}
        description={
          <Trans ns="userProfile">
            Also included in your discussion forum profile (optional).
          </Trans>
        }
        label={<Trans ns="userProfile">Email Address</Trans>}
      />
      <ProfileAvatarUploader />
      <TextInput
        textarea
        name="affiliations"
        onChange={(affiliations) =>
          onChange((prev) => ({ ...prev, affiliations }))
        }
        value={props.state.affiliations || ""}
        placeholder="e.g. University of California Santa Barbara"
        label={<Trans ns="userProfile">Affiliations and Bio</Trans>}
      />
    </div>
  );
}
export function useUserProfileState() {
  const { data } = useMyProfileQuery();
  const onError = useGlobalErrorHandler();

  const [state, setState] = useState<{
    fullname?: string;
    nickname?: string;
    email?: string;
    affiliations?: string;
  }>({});

  const [submissionAttempted, setSubmissionAttempted] = useState(false);

  const [mutate, mutationState] = useUpdateProfileMutation({
    onError,
  });

  const submit = useCallback(() => {
    setSubmissionAttempted(true);
    if (!data?.me?.id) {
      throw new Error("data.me.id not set");
    }
    const hasErrors = Object.keys(validateProps(state, (s) => s)).length > 0;
    if (!hasErrors) {
      return mutate({
        variables: {
          userId: data.me.id,
          ...state,
        },
      });
    } else {
      throw new Error("Profile invalid");
    }
  }, [mutate, setSubmissionAttempted, data?.me?.id, state]);

  useEffect(() => {
    if (
      data?.me?.profile &&
      !(state.fullname || state.affiliations || state.email || state.nickname)
    ) {
      const profile = data.me.profile;
      setState({
        fullname: profile.fullname || undefined,
        nickname: profile.nickname || undefined,
        email: profile.email || undefined,
        affiliations: profile.affiliations || undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const hasErrors = useMemo(() => {
    return Object.keys(validateProps(state, (s) => s)).length > 0;
  }, [state]);

  return {
    state,
    hasErrors,
    setState,
    submissionAttempted,
    submit,
    mutationState,
  };
}
