import { Trans as T, useTranslation } from "react-i18next";
import getSlug from "../../getSlug";
import {
  SketchingDetailsFragment,
  useSketchClassesQuery,
  useTemplateSketchClassesQuery,
} from "../../generated/graphql";
import TemplateChooser from "./TemplateChooser";
import { useCallback, useMemo } from "react";
import NavSidebar, { NavSidebarItem } from "../../components/NavSidebar";
import Button from "../../components/Button";
import { useHistory, useRouteMatch, Switch, Route } from "react-router-dom";
import { PlusIcon } from "@heroicons/react/outline";
import SketchClassForm from "./SketchClassForm";

const Trans = (props: any) => <T ns="admin:sketching" {...props} />;

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
            <div className="max-w-xl  rounded mx-auto mt-10 p-4">
              <h2 className="text-lg font-semibold mb-2">
                <Trans>Create a new Sketch Class</Trans>
              </h2>
              <TemplateChooser onCreate={onCreate} />
              <Button
                label={t("Cancel")}
                className="mt-4"
                href={`/${getSlug()}/admin/sketching/`}
              />
            </div>
          </div>
        </Route>
        <Route
          path={`${path}/:id?`}
          children={({ match }) => {
            const selectedSketch = match?.params.id
              ? sketchClasses.find((sc) => sc.id === parseInt(match.params.id!))
              : null;
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
                            <Trans>Add</Trans>
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
                      <div className="max-w-xl  rounded mx-auto mt-10 p-4">
                        <h2 className="text-lg font-semibold mb-2">
                          <Trans>Create your first Sketch Class</Trans>
                        </h2>
                        <TemplateChooser onCreate={onCreate} />
                      </div>
                    </div>
                  )}
                {selectedSketch && (
                  <SketchClassForm
                    // trigger reload of whole form component
                    key={selectedSketch.id}
                    sketchClass={selectedSketch}
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
