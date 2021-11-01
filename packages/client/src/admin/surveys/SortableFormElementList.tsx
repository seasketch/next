import { FormElement, FormElementType, Maybe } from "../../generated/graphql";
import { collectText } from "./collectText";
import {
  DragDropContext,
  Draggable,
  DraggableProvided,
  DraggableStateSnapshot,
  Droppable,
} from "react-beautiful-dnd";
import Spinner from "../../components/Spinner";
import { CSSProperties } from "react";

interface Props {
  items: (Pick<
    FormElement,
    "id" | "body" | "typeId" | "position" | "exportId"
  > & { type?: Maybe<Pick<FormElementType, "label">> })[];
  selection?: number;
  onClick?: (id: number) => void;
  onReorder?: (sortedIds: number[]) => void;
  className?: CSSProperties;
}

/**
 * Drag & drop sortable list of form elements intended to be used in the survey
 * editor admin interface. This is a "controlled" component, in that it doesn't
 * maintain any internal state but rather exposes onClick and onReorder handlers
 * which are expected to update selection and item order state.
 * @param props
 * @returns
 */
export default function SortableFormElementList(props: Props) {
  const welcome = props.items.find((i) => i.typeId === "WelcomeMessage");
  const thankYou = props.items.find((i) => i.typeId === "ThankYou");
  const sortableFormElements = props.items.filter(
    (i) => i.typeId !== "WelcomeMessage" && i.typeId !== "ThankYou"
  );

  return (
    <div className={`pb-4 pt-1 ${props.className}`}>
      {welcome && (
        <div className="mb-2">
          <FormElementListItem
            selected={props.selection === welcome.id}
            element={welcome}
            typeName={welcome.type?.label || welcome.typeId}
            onClick={() => {
              if (props.onClick) {
                props.onClick(welcome.id);
              }
            }}
            draggable={false}
          />
        </div>
      )}
      <DragDropContext
        onDragEnd={(result) => {
          if (!result.destination) {
            return;
          } else {
            let sorted = reorder(
              sortableFormElements,
              result.source.index,
              result.destination.index
            );
            if (welcome) {
              sorted = [welcome, ...sorted];
            }
            if (props.onReorder) {
              props.onReorder(sorted.map((i) => i.id));
            }
          }
        }}
      >
        <Droppable droppableId="droppable">
          {(provided, snapshot) => (
            <div
              className="space-y-2"
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {sortableFormElements.map((element, i) => (
                <Draggable
                  index={i}
                  draggableId={element.id.toString()}
                  key={element.id}
                  isDragDisabled={element.typeId === "WelcomeMessage"}
                >
                  {(provided, snapshot) => (
                    <FormElementListItem
                      draggable={true}
                      provided={provided}
                      snapshot={snapshot}
                      key={element.id}
                      selected={element.id === props.selection}
                      element={element}
                      typeName={element.type?.label || element.typeId}
                      creating={element.id === 9999999999}
                      onClick={() => {
                        if (props.onClick) {
                          props.onClick(element.id);
                        }
                      }}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      {thankYou && (
        <div className="mt-2">
          <FormElementListItem
            selected={props.selection === thankYou.id}
            element={thankYou}
            typeName={thankYou.type?.label || thankYou.typeId}
            onClick={() => {
              if (props.onClick) {
                props.onClick(thankYou.id);
              }
            }}
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}

function FormElementListItem({
  element,
  typeName,
  onClick,
  selected,
  provided,
  draggable,
  snapshot,
  creating,
}: {
  element: Pick<FormElement, "body" | "exportId">;
  typeName: string;
  onClick?: () => void;
  selected: boolean;
  provided?: DraggableProvided;
  draggable?: boolean;
  snapshot?: DraggableStateSnapshot;
  creating?: boolean;
}) {
  return (
    <div
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      // style={provided?.draggableProps.style}
      style={{ ...provided?.draggableProps.style, cursor: "pointer" }}
      onClick={onClick}
      className={`relative select-none cursor-pointer ${
        snapshot?.isDragging && "shadow-lg"
      } mx-2 px-4 py-2 ${
        draggable && "shadow-md"
      } bg-white w-50 border border-black border-opacity-20 rounded ${
        selected && "ring-2 ring-blue-300"
      } ${creating ? "opacity-50" : ""}`}
    >
      {creating && <Spinner className="absolute right-1 top-1" />}
      <div className="">{typeName}</div>
      <div className="text-xs italic overflow-x-hidden truncate">
        {collectText(element.body)}
      </div>
    </div>
  );
}

/**
 * Reorders the given list, moving an item from startIndex to endIndex
 * @param list
 * @param startIndex
 * @param endIndex
 * @returns
 */
function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}
