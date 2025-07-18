import { useTranslation } from "react-i18next";
import { SketchingDetailsFragment } from "../../generated/graphql";

export default function SketchClassReportsAdmin({
  sketchClass,
}: {
  sketchClass: SketchingDetailsFragment;
}) {
  const { t } = useTranslation("admin:sketching");

  return (
    <div className="flex flex-col w-full h-full">
      {/* Header */}
      <div className="bg-gray-100 p-4 flex-none border-b shadow"></div>

      {/* Main */}
      <div className="flex-1 flex">
        {/* left sidebar */}
        <div className="w-0 bg-white flex-none border-r shadow"></div>

        {/* main content */}
        <div className="flex-1 p-8">
          <div className="w-128 mx-auto bg-white rounded-lg shadow-xl border border-t-black/5 border-l-black/10 border-r-black/15 border-b-black/20">
            {/* report header */}
            <div className="p-4 border-b bg-white rounded-t-lg">
              {sketchClass.name} {t("Report")}
            </div>
            {/* report body */}
            <div className="p-4 bg-gray-50 rounded-b-lg"></div>
            {/* report footer */}
            {/* <div className="p-4 border-t"></div> */}
          </div>
        </div>

        {/* right sidebar */}
        <div className="w-0 bg-white flex-none border-l shadow"></div>
      </div>

      {/* Footer */}
      {/* <div className="bg-gray-100 p-4 flex-none border-t shadow"></div> */}
    </div>
  );
}
