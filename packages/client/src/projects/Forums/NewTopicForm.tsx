import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import ProfilePhoto from "../../admin/users/ProfilePhoto";
import Button from "../../components/Button";
import { AuthorProfileFragment } from "../../generated/graphql";
import getSlug from "../../getSlug";
import useLocalStorage from "../../useLocalStorage";
import UserProfileModal from "../UserProfileModal";
import PostContentEditor from "./PostContentEditor";

export default function NewTopicForm({
  profile,
}: {
  profile: AuthorProfileFragment;
}) {
  const { t } = useTranslation("forums");
  const [title, setTitle] = useLocalStorage(`post-title-${getSlug()}`, "");
  const [content, setContent] = useLocalStorage(
    `post-content-${getSlug()}`,
    undefined
  );
  const [modalOpen, setModalOpen] = useState(false);

  const openProfileModal = useCallback(() => {
    setModalOpen(true);
  }, [setModalOpen]);
  return (
    <div>
      <div className="bg-white shadow">
        <div className="flex border-b p-1 pt-2 px-2 pb-1.5 items-center">
          <button
            onClick={openProfileModal}
            className="ml-0.5 w-12 h-12 flex items-center"
          >
            <ProfilePhoto {...profile} canonicalEmail="" />
          </button>
          <div className="flex-1">
            <button
              onClick={openProfileModal}
              className="text-sm pl-3 hover:text-gray-600"
            >
              {profile.nickname || profile.fullname || profile.email}
            </button>
            <input
              autoFocus={!content}
              className="-mt-0.5 pb-1 pt-0 pl-3 border-none outline-none focus:outline-none active:outline-none focus:border-none focus:ring-0 w-full font-semibold text-lg"
              type="text"
              value={title}
              placeholder={t("New Topic Title...")}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>
        <PostContentEditor
          autofocus={Boolean(title && title.length)}
          initialContent={content}
          onChange={setContent}
        />
      </div>
      <div className="flex justify-end items-center p-2 py-3 space-x-2">
        <Button label={t("Cancel")} />
        <Button label={t("Post New Topic")} primary />
      </div>
      {modalOpen && (
        <UserProfileModal onRequestClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}
