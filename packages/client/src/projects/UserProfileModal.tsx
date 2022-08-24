import { useTranslation } from "react-i18next";
import UserProfileForm, { useUserProfileState } from "../auth/UserProfileForm";
import Modal from "../components/Modal";

export default function UserProfileModal({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  const { t } = useTranslation();
  const profile = useUserProfileState();
  return (
    <Modal
      autoWidth
      scrollable
      onRequestClose={onRequestClose}
      title={t("Your User Profile")}
      footer={[
        {
          label: t("Save"),
          disabled: profile.mutationState.loading,
          loading: profile.mutationState.loading,
          onClick: () => {
            profile.submit().then(onRequestClose);
          },
          variant: "primary",
        },
        {
          label: t("Close"),
          disabled: profile.mutationState.loading,
          loading: profile.mutationState.loading,
          onClick: onRequestClose,
        },
      ]}
    >
      <UserProfileForm
        showValidationErrors={profile.submissionAttempted}
        onChange={profile.setState}
        state={profile.state}
      />
    </Modal>
  );
}
