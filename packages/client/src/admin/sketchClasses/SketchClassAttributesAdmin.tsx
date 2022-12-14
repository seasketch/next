import {
  DeleteFormElementDocument,
  SketchingDetailsFragment,
  useDeleteFormElementMutation,
} from "../../generated/graphql";
import { Trans as I18n, useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import SketchForm from "../../projects/Sketches/SketchForm";
import AddFormElementButton from "../surveys/AddFormElementButton";
import { MenuIcon, PencilIcon, TrashIcon } from "@heroicons/react/outline";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import useDialog from "../../components/useDialog";
import { useDelete } from "../../graphqlHookWrappers";
const Trans = (props: any) => <I18n ns="sketching" {...props} />;

export default function SketchClassAttributesAdmin({
  sketchClass,
}: {
  sketchClass: SketchingDetailsFragment;
}) {
  const { t } = useTranslation("admin:sketching");
  const scrollableRef = useRef<HTMLDivElement>(null);
  const del = useDelete(DeleteFormElementDocument);

  const { confirmDelete } = useDialog();
  // const [submissionAttempted, setSubmissionAttempted] = useState(false);
  return (
    <div className="flex flex-col h-full">
      <p className="text-sm  bg-gray-50 p-4 border-b border-black border-opacity-5">
        <Trans>
          This form can be customized to collect important information about
          sketches from your users. The name field is the only form element
          required by SeaSketch which cannot be modified.
        </Trans>
        <span className="block mt-2 -mb-1">
          <AddFormElementButton
            label={t("Add a field")}
            existingTypes={[]}
            formId={sketchClass.form!.id}
            formIsSketchClass={true}
            nextPosition={(sketchClass.form?.formElements || []).length}
            onAdd={(id) => {
              setTimeout(() => {
                if (scrollableRef.current) {
                  scrollableRef.current.scrollTo({
                    top: 20000,
                    behavior: "auto",
                  });
                }
              }, 16);
            }}
          />
        </span>
      </p>
      <div className="p-4 space-y-4 overflow-y-auto" ref={scrollableRef}>
        <SketchForm
          startingProperties={{}}
          submissionAttempted={false}
          formElements={sketchClass.form?.formElements || []}
          editable={true}
          buttons={(element) => (
            <>
              <button className="py-1 flex-1 cursor-move">
                <MenuIcon className="w-5 h-5 text-gray-500 hover:text-black" />
              </button>
              <button
                className="py-1 flex-1"
                onClick={async () => {
                  confirmDelete({
                    message: t("Are you sure you want to delete this item?"),
                    onDelete: async () => {
                      await del(element);
                    },
                  });
                }}
              >
                <TrashIcon className="w-5 h-5 text-gray-500 hover:text-black" />
              </button>
              <button className="py-1 flex-1">
                <PencilIcon className="w-5 h-5 text-gray-500 hover:text-black" />
              </button>
            </>
          )}
        />
      </div>
    </div>
  );
}
