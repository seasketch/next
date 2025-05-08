// import { Trans, useTranslation } from "react-i18next";
// import Modal from "../../components/Modal";
// import { useState } from "react";
// import Switch from "../../components/Switch";
// import {
//   UserProfileDetailsFragment,
//   useUpdateLandClippingSettingsMutation,
// } from "../../generated/graphql";
// import getSlug from "../../getSlug";
// import InlineAuthorDetails from "../../projects/Forums/InlineAuthorDetails";
// import InlineAuthor from "../../components/InlineAuthor";

// export default function LandClippingModal({
//   onRequestClose,
//   enabled,
//   lastUpdated,
//   author,
// }: {
//   onRequestClose: () => void;
//   enabled: boolean;
//   lastUpdated: Date;
//   author: UserProfileDetailsFragment;
// }) {
//   const { t } = useTranslation("admin:geography");
//   const [state, setState] = useState(enabled);
//   const [mutation, mutationState] = useUpdateLandClippingSettingsMutation();
//   return (
//     <Modal
//       disableBackdropClick={state !== enabled}
//       title={t("Land Clipping")}
//       onRequestClose={onRequestClose}
//       footer={[
//         {
//           label: t("Cancel"),
//           disabled: mutationState.loading,
//           onClick: onRequestClose,
//         },
//         {
//           label: t("Save"),
//           variant: "primary",
//           disabled: mutationState.loading || state === enabled,
//           loading: mutationState.loading,
//           onClick: async () => {
//             // save state
//             await mutation({
//               variables: { enable: state, slug: getSlug() },
//             });
//             onRequestClose();
//           },
//         },
//       ]}
//     >
//       <p className="text-sm w-full flex items-center space-x-4 pb-5 pt-1">
//         <Switch isToggled={state} onClick={(val) => setState(val)} />
//         <label>{t("Enable land removal by default")}</label>
//       </p>
//       <p className="text-sm">
//         <Trans ns="admin:geography">
//           SeaSketch maintains a recent copy of the{" "}
//           <a
//             target="_blank"
//             className="underline"
//             href="https://daylightmap.org/coastlines.html"
//           >
//             Daylight Coastlines dataset
//           </a>{" "}
//           for use in removing land from shapes drawn in the ocean. This is a
//           highly accurate, well maintained global dataset based on
//           OpenStreetMap. We recommend using this layer rather than uploading
//           custom land layers and using boundary layers that don't include a
//           complex coastline in order to speed up calculations.
//         </Trans>
//       </p>
//       <p className="flex items-center py-2 text-sm space-x-2">
//         <span>
//           <Trans ns="admin:geography">
//             Layer last updated {lastUpdated.toLocaleDateString()} by{" "}
//           </Trans>
//         </span>
//         <InlineAuthor profile={author} />
//       </p>
//     </Modal>
//   );
// }
