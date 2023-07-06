import { useDebouncedFn } from "beautiful-react-hooks";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  AdminSketchingDetailsFragment,
  useUpdateSketchClassStyleMutation,
} from "../../generated/graphql";
import GLStyleEditor from "../data/GLStyleEditor/GLStyleEditor";

export default function SketchClassStyleAdmin({
  sketchClass,
}: {
  sketchClass: AdminSketchingDetailsFragment;
}) {
  const onError = useGlobalErrorHandler();
  const [mutate, mutationState] = useUpdateSketchClassStyleMutation({
    onError,
  });

  const update = useDebouncedFn(
    (id: number, newStyle: string) => {
      mutate({
        variables: {
          id,
          style: newStyle ? JSON.parse(newStyle) : null,
        },
      });
    },
    500,
    {
      trailing: true,
    }
  );

  return (
    <GLStyleEditor
      className="flex-1 overflow-hidden"
      initialStyle={JSON.stringify(sketchClass.mapboxGlStyle || [])}
      onChange={(newStyle) => {
        update(sketchClass.id, newStyle);
      }}
    />
  );
}
