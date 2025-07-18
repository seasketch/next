import { useTranslation } from "react-i18next";
import getSlug from "../../getSlug";
import {
  SketchingDetailsFragment,
  useSketchClassesQuery,
  useTemplateSketchClassesQuery,
} from "../../generated/graphql";
import TemplateChooser from "./TemplateChooser";
import { useCallback, useMemo, useState } from "react";
import NavSidebar, { NavSidebarItem } from "../../components/NavSidebar";
import Button from "../../components/Button";
import { useHistory, useRouteMatch, Switch, Route } from "react-router-dom";
import { PlusIcon } from "@heroicons/react/outline";
import SketchClassForm from "./SketchClassForm";

export default function SketchClassAdmin() {
  const { t } = useTranslation("admin:sketching");
  const { path } = useRouteMatch();
  const slug = getSlug();
  const { data, loading } = useSketchClassesQuery({
    variables: {
      slug,
    },
  });
  const history = useHistory();

  const sketchClasses = useMemo(() => {
    if (data?.projectBySlug?.sketchClasses?.length) {
      return data.projectBySlug.sketchClasses.filter(
        (sc) => !Boolean(sc.formElementId)
      );
    } else {
      return [];
    }
  }, [data?.projectBySlug?.sketchClasses]);

  // Preload to prevent waterfall fo queries
  const templateQuery = useTemplateSketchClassesQuery({});

  const navItems: NavSidebarItem[] = useMemo(() => {
    return [
      ...sketchClasses.map((sc) => ({
        label: sc.name,
        href: `/${slug}/admin/sketching/${sc.id}`,
        compact: true,
        className: sc.isArchived ? "text-gray-500" : "",
        badge: sc.isArchived ? "archived" : undefined,
      })),
    ];
  }, [sketchClasses, slug]);

  const [showSuperuserOptions, setShowSuperuserOptions] = useState(false);

  const onCreate = useCallback(
    (sc: SketchingDetailsFragment) => {
      // eslint-disable-next-line i18next/no-literal-string
      history.push(`/${getSlug()}/admin/sketching/${sc.id}`);
    },
    [history]
  );

  return (
    <div className="flex min-h-full">
      <Switch>
        <Route exact path={`${path}/new`}>
          <div className="items-center flex-1">
            <div className="max-w-xl rounded mx-auto mt-10 p-4">
              <h2 className="text-lg font-semibold mb-2">
                {t("Create a new Sketch Class")}
              </h2>
              <TemplateChooser
                showSuperuserOptions={showSuperuserOptions}
                onCreate={onCreate}
              />
              <div className="flex items-center mt-4">
                <Button
                  label={t("Cancel")}
                  className=""
                  href={`/${getSlug()}/admin/sketching/`}
                />
                <div className="flex-1 text-right absolute right-5 top-2">
                  <div className="opacity-10 hover:opacity-100">
                    <input
                      type="checkbox"
                      className="ml-4 rounded"
                      checked={showSuperuserOptions}
                      onChange={(e) => {
                        setShowSuperuserOptions(e.target.checked);
                      }}
                    />
                    <label className="ml-2 text-xs">
                      {t("Show superuser options")}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Route>
        <Route
          path={`${path}/:id?/:tab?`}
          children={({ match }) => {
            const selectedSketch = match?.params.id
              ? sketchClasses.find((sc) => sc.id === parseInt(match.params.id!))
              : null;
            const selectedTab = match?.params.tab || "settings";

            return (
              <>
                {(sketchClasses.length > 0 ||
                  loading ||
                  templateQuery.loading) && (
                  <NavSidebar
                    className="z-10"
                    loading={loading}
                    loadingSkeletonItemCount={4}
                    items={navItems}
                    header={t("Sketch Classes")}
                    headerButton={
                      <Button
                        title={"Create a new Sketch Class"}
                        small
                        href={`/${getSlug()}/admin/sketching/new`}
                        label={
                          <>
                            {t("Add")}
                            <PlusIcon className="w-4 h-4 ml-2" />
                          </>
                        }
                      />
                    }
                  />
                )}
                {!loading &&
                  sketchClasses.length === 0 &&
                  !templateQuery.loading && (
                    <div className="items-center flex-1">
                      <div className="max-w-xl rounded mx-auto mt-10 p-4">
                        <h2 className="text-lg font-semibold mb-2">
                          {t("Create your first Sketch Class")}
                        </h2>
                        <TemplateChooser onCreate={onCreate} />
                      </div>
                    </div>
                  )}
                {selectedSketch && (
                  <SketchClassForm
                    key={selectedSketch.id}
                    sketchClass={selectedSketch}
                    selectedTab={selectedTab}
                    onDelete={() => {
                      history.push(`/${slug}/admin/sketching`);
                    }}
                  />
                )}
              </>
            );
          }}
        />
      </Switch>
    </div>
  );
}
