import { useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import {
  ApiKeysDocument,
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useRevokeApiKeyMutation,
} from "../generated/graphql";
import Spinner from "../components/Spinner";
import Button from "../components/Button";
import useDialog from "../components/useDialog";
import InlineAuthor from "../components/InlineAuthor";
import { useState } from "react";
import set from "lodash.set";
import Modal from "../components/Modal";

export default function ProjectAPIKeys({ projectId }: { projectId: number }) {
  const onError = useGlobalErrorHandler();
  const apiKeysQuery = useApiKeysQuery({
    variables: { projectId },
    onError,
  });
  const { t } = useTranslation("admin");
  const { prompt, confirm } = useDialog();
  const [createToken, createTokenState] = useCreateApiKeyMutation({
    onError,
    refetchQueries: [ApiKeysDocument],
    awaitRefetchQueries: true,
  });
  const [revokeKey, revokeKeyState] = useRevokeApiKeyMutation({
    onError,
    refetchQueries: [ApiKeysDocument],
    awaitRefetchQueries: true,
  });
  const [token, setToken] = useState<{ token: string; label: string } | null>(
    null
  );

  return (
    <div className="">
      <div className="shadow sm:rounded-md sm:overflow-hidden">
        <div className="px-4 py-5 bg-white sm:p-6 space-y-5">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            {t("API Keys")}
          </h3>
          <p className="text-sm text-gray-500">
            {t(
              "SeaSketch API keys can be used to access project resources programmatically, such as referencing data layers from geoprocessing functions. These keys may be revoked if they are misused."
            )}
          </p>
          {apiKeysQuery.loading && !apiKeysQuery.data && <Spinner />}
          {apiKeysQuery.error && <div>{t("Error loading API keys")}</div>}

          {apiKeysQuery.data && (
            <div className="space-y-6 py-2 pb-4">
              {[...(apiKeysQuery.data?.project?.apiKeysConnection?.nodes || [])]
                .sort((a, b) => {
                  // sort by isRevoked
                  if (a.isRevoked && !b.isRevoked) return 1;
                  if (b.isRevoked && !a.isRevoked) return -1;
                  // sort by created at
                  return b.createdAt - a.createdAt;
                })
                .slice(0, 8)
                .map((key) => (
                  <div
                    key={key.id}
                    className={`flex items-center w-full space-x-4 ${
                      key.isRevoked ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        {key.label}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center space-x-2">
                        <span
                          title={t("Created {{date}}", {
                            date: new Date(key.createdAt).toLocaleString(),
                          })}
                        >
                          {t("Created {{date}} by ", {
                            date: new Date(key.createdAt).toLocaleDateString(),
                          })}
                        </span>
                        {key.userByCreatedBy?.profile ? (
                          <InlineAuthor
                            profile={key.userByCreatedBy?.profile}
                            className="inline-flex"
                          />
                        ) : (
                          t("Unknown")
                        )}
                      </div>
                    </div>
                    {(key.lastUsedAt || key.createdAt) && (
                      <div className="w-24 text-center flex-none">
                        {/* add lastUsed */}
                        <span
                          className="text-sm text-gray-500"
                          title={t("Last used {{date}}", {
                            date: new Date(
                              key.lastUsedAt || key.createdAt
                            ).toLocaleString(),
                          })}
                        >
                          {t("Last used {{date}}", {
                            date: new Date(
                              key.lastUsedAt || key.createdAt
                            ).toLocaleDateString(),
                          })}
                        </span>
                      </div>
                    )}
                    <div className="w-24 text-center flex-none">
                      {key.isRevoked ? (
                        <span className="text-red-500 text-sm">
                          {t("Revoked")}
                        </span>
                      ) : (
                        <Button
                          small
                          onClick={async () => {
                            const confirmed = await confirm(
                              t(
                                "Are you sure you want to revoke this API key?"
                              ),
                              {
                                icon: "delete",
                                description: t(
                                  "Scripts or services using this key will stop working."
                                ),
                              }
                            );
                            if (confirmed) {
                              await revokeKey({
                                variables: {
                                  id: key.id,
                                },
                              });
                            }
                          }}
                          label={t("Revoke")}
                        />
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
          <Button
            onClick={() => {
              prompt({
                placeholder: "e.g. data-access-geoprocessing-prod",
                message: t("Enter a label to describe your new API key"),
                onSubmit: async (label) => {
                  // create key
                  const token = await createToken({
                    variables: {
                      projectId,
                      label,
                    },
                  });
                  if (!token.data?.createApiKey?.token) {
                    onError(new Error("Failed to create API key"));
                    return;
                  } else {
                    setToken({
                      token: token.data.createApiKey.token,
                      label,
                    });
                  }
                },
              });
            }}
            label={
              apiKeysQuery.data &&
              apiKeysQuery.data.project?.apiKeysConnection?.nodes?.length === 0
                ? t("Create your first API Key")
                : t("Create a new API Key")
            }
          />
          {token && (
            <Modal
              title={t("API Key Created")}
              onRequestClose={() => setToken(null)}
              footer={[
                {
                  label: t("Close"),
                  onClick: () => setToken(null),
                },
              ]}
            >
              <div className="">
                <p className="text-sm text-gray-500">
                  {t(
                    "This key is used to access project resources programmatically. Store it securely. You will not be able to view this token after closing this window."
                  )}
                </p>
                <br />
                <textarea
                  className="text-sm font-mono w-full h-32"
                  ref={(el) => {
                    el?.focus();
                    // Select the entire contents of the textarea
                    el?.setSelectionRange(0, el.value.length);
                  }}
                  value={token.token}
                  readOnly
                ></textarea>
              </div>
            </Modal>
          )}
        </div>
      </div>
    </div>
  );
}
