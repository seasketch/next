import { CheckIcon, XIcon } from "@heroicons/react/outline";
import { PencilIcon } from "@heroicons/react/solid";
import { createContext, useContext, useEffect, useState } from "react";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Spinner from "../../components/Spinner";

export const CellEditorContext = createContext<{ editing: boolean }>({
  editing: false,
});

export type CellEditorComponent<ValueType = any, ComponentSettingsType = any> =
  React.FunctionComponent<{
    value: ValueType;
    disabled: boolean;
    onChange: (value: ValueType) => void;
    onRequestSave: () => void;
    onRequestCancel: () => void;
    componentSettings: ComponentSettingsType;
  }>;

export type EditorsList = [
  formElementId: number,
  component: CellEditorComponent
][];
interface EditableResponseCellProps {
  data: any;
  editors: EditorsList;
  updateValue: (value: any) => Promise<any>;
  onStateChange?: (editing: boolean) => void;
  componentSettings: any;
}

interface SimpleEditableResponseCellProps {
  elementId: number;
  value: any;
  editor: CellEditorComponent;
  updateValue: (value: any) => Promise<any>;
  onStateChange?: (editing: boolean) => void;
  componentSettings: any;
}

function isSimple(
  props: SimpleEditableResponseCellProps | EditableResponseCellProps
): props is SimpleEditableResponseCellProps {
  return (props as SimpleEditableResponseCellProps).editor !== undefined;
}

const EditableResponseCell: React.FunctionComponent<
  EditableResponseCellProps | SimpleEditableResponseCellProps
> = (props) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedValues, setEditedValues] = useState({});
  const context = useContext(CellEditorContext);
  const onError = useGlobalErrorHandler();

  useEffect(() => {
    if (props.onStateChange) {
      props.onStateChange(editing);
    }
  }, [editing]);

  const save = () => {
    if (!saving) {
      setSaving(true);
      props
        .updateValue(editedValues)
        .then(() => {
          setEditing(false);
        })
        .catch((e) => {
          setSaving(false);
          setEditing(false);
          onError(e);
        });
    }
  };

  const cancel = () => setEditing(false);

  if (editing) {
    // eslint-disable-next-line i18next/no-literal-string
    return (
      <div className="flex w-full">
        {isSimple(props) && (
          <div className="flex-1">
            <props.editor
              componentSettings={props.componentSettings}
              value={props.value}
              onChange={(val) => {
                setEditedValues((prev) => ({
                  ...prev,
                  [props.elementId]: val,
                }));
              }}
              disabled={saving}
              onRequestCancel={cancel}
              onRequestSave={save}
            />
          </div>
        )}
        {!isSimple(props) &&
          props.editors.map(([id, Editor]) => {
            return (
              <div className="flex-1">
                <Editor
                  componentSettings={props.componentSettings}
                  key={id}
                  value={props.data[id]}
                  disabled={saving}
                  onChange={(value) =>
                    setEditedValues((prev) => ({
                      ...prev,
                      [id]: value,
                    }))
                  }
                  onRequestSave={save}
                  onRequestCancel={cancel}
                />
              </div>
            );
          })}
        <div className="h-full flex align-middle items-center flex-none space-x-1 mx-1">
          <button
            title="Save"
            className={`p-1 ${
              saving ? "pointer-events-none" : "border rounded-full"
            }`}
            onClick={save}
          >
            {saving ? (
              <Spinner className="w-4 h-4 p-0" />
            ) : (
              <CheckIcon className="w-4 h-4 text-green-800" />
            )}
          </button>
          <button
            disabled={saving}
            title="Cancel"
            className={`p-1 border rounded-full filter ${
              saving ? "opacity-5 saturate-0 pointer-events-none" : ""
            }`}
            onClick={cancel}
          >
            <XIcon className="w-4 h-4 text-red-800" />
          </button>
        </div>
      </div>
    );
  } else {
    return (
      <div className="relative w-full group">
        <button
          disabled={context.editing}
          className="text-gray-500 w-6 h-6 flex align-middle justify-center items-center p-1 absolute right-0 -top-0.5 group-hover:opacity-100 opacity-0 "
          onClick={() => {
            setEditing(true);
          }}
        >
          <PencilIcon className=" w-4 h-4 p-0 inline" />
        </button>
        {props.children}
      </div>
    );
  }
};

export default EditableResponseCell;
