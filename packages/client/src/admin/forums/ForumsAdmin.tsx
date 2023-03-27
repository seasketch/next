import { useTranslation } from "react-i18next";
import getSlug from "../../getSlug";
import {
  useTemplateSketchClassesQuery,
  useForumAdminListQuery,
  useCreateForumMutation,
  ForumAdminListQuery,
  ForumAdminListDocument,
} from "../../generated/graphql";
import { useCallback, useMemo } from "react";
import NavSidebar, { NavSidebarItem } from "../../components/NavSidebar";
import Button from "../../components/Button";
import { useRouteMatch } from "react-router-dom";
import { PlusIcon } from "@heroicons/react/outline";
import useDialog from "../../components/useDialog";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import ForumForm from "./ForumForm";

export default function ForumsAdmin() {
  const { t } = useTranslation("admin:forums");
  const { params } = useRouteMatch<{ id?: string }>();
  const slug = getSlug();
  const { data, loading } = useForumAdminListQuery({
    variables: {
      slug,
    },
  });
  const onError = useGlobalErrorHandler();
  const [create] = useCreateForumMutation({
    onError,
    update: (cache, { data }) => {
      const forum = data?.createForum?.forum;
      if (forum) {
        const forums = cache.readQuery<ForumAdminListQuery>({
          query: ForumAdminListDocument,
          variables: {
            slug,
          },
        });
        if (forums?.projectBySlug?.forums) {
          cache.writeQuery({
            query: ForumAdminListDocument,
            variables: {
              slug,
            },
            data: {
              ...forums,
              projectBySlug: {
                ...forums.projectBySlug,
                forums: [
                  ...forums?.projectBySlug?.forums.filter(
                    (f) => f.id !== forum.id
                  ),
                  forum,
                ],
              },
            },
          });
        }
      }
    },
  });

  const forums = useMemo(() => {
    return [...(data?.projectBySlug?.forums || [])].sort(
      (a, b) => (a.position || 0) - (b.position || 0)
    );
  }, [data?.projectBySlug?.forums]);

  // Preload to prevent waterfall fo queries
  const templateQuery = useTemplateSketchClassesQuery({});

  const navItems: NavSidebarItem[] = useMemo(() => {
    return [
      ...forums.map((forum) => ({
        label: forum.name,
        href: `/${slug}/admin/forums/${forum.id}`,
        compact: true,
        className: forum.archived ? "text-gray-500" : "",
        badge: forum.archived ? "archived" : undefined,
        description: forum.description || "",
      })),
    ];
  }, [forums, slug]);

  const { prompt } = useDialog();

  const createForum = useCallback(async () => {
    if (data?.projectBySlug?.id) {
      const projectId = data.projectBySlug.id;
      await prompt({
        message: t("Choose a name for your forum"),
        onSubmit: async (name) => {
          if (name.length > 0) {
            await create({
              variables: {
                name,
                projectId,
              },
            });
          }
        },
      });
    }
  }, [data?.projectBySlug?.id, prompt, t, create]);

  const selectedForum = params.id
    ? forums.find((f) => f.id === parseInt(params.id!))
    : null;
  return (
    <div className="flex min-h-full">
      <NavSidebar
        className="z-10"
        loading={loading}
        loadingSkeletonItemCount={4}
        items={navItems}
        header={t("Forums")}
        headerButton={
          <Button
            title={"Create a new Forum"}
            small
            label={
              <>
                {t("Add")}
                <PlusIcon className="w-4 h-4 ml-2" />
              </>
            }
            onClick={createForum}
          />
        }
      />
      {!loading && forums.length === 0 && !templateQuery.loading && (
        <div className="items-center flex-1 px-2">
          <div className="max-w-xl  rounded mx-auto mt-10 p-4 border-4 border-dashed">
            <h2 className="text-base mb-2">
              {t(
                `Your project has no discussion forums configured. Forums can be used by your users to share discuss data layers and sketches.`
              )}
            </h2>
            <Button
              label={t("Create your first Forum")}
              onClick={createForum}
            />
            {/* <TemplateChooser onCreate={onCreate} /> */}
          </div>
        </div>
      )}
      {selectedForum && (
        <ForumForm key={selectedForum.id} forum={selectedForum} />
      )}
    </div>
  );
}
