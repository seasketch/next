import {
  FormElement,
  FormElementFullDetailsFragment,
  FormElementType,
  Maybe,
} from "../../generated/graphql";
import { collectHeaders, collectQuestion, collectText } from "./collectText";
import {
  DragDropContext,
  Draggable,
  DraggableProvided,
  DraggableStateSnapshot,
  Droppable,
} from "react-beautiful-dnd";
import Spinner from "../../components/Spinner";
import { CSSProperties, useState } from "react";
import { components } from "../../formElements";
import { defaultFormElementIcon } from "../../formElements/FormElement";

interface Props {
  items: FormElementFullDetailsFragment[];
  selection?: number;
  onClick?: (id: number) => void;
  onReorder?: (sortedIds: number[]) => void;
  className?: CSSProperties;
  dim: boolean;
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
  const featureName = props.items.find((i) => i.typeId === "FeatureName");
  const sapRange = props.items.find((i) => i.typeId === "SAPRange");
  const sortableFormElements = props.items.filter(
    (i) =>
      i.typeId !== "WelcomeMessage" &&
      i.typeId !== "ThankYou" &&
      i.typeId !== "FeatureName" &&
      i.typeId !== "SAPRange"
  );
  const [collapseSpatialItems, setCollapseSpatialItems] = useState(false);

  return (
    <div className={`pb-4 pt-1 ${props.className}`}>
      {welcome && (
        <div className="mb-2">
          <FormElementListItem
            dim={props.dim}
            typeId={welcome.typeId}
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
      {featureName && (
        <div className="mb-2">
          <FormElementListItem
            dim={props.dim}
            typeId={featureName.typeId}
            selected={props.selection === featureName.id}
            element={featureName}
            typeName={featureName.type?.label || featureName.typeId}
            onClick={() => {
              if (props.onClick) {
                props.onClick(featureName.id);
              }
            }}
            draggable={false}
          />
        </div>
      )}
      {sapRange && (
        <div className="mb-2">
          <FormElementListItem
            dim={props.dim}
            typeId={sapRange.typeId}
            selected={props.selection === sapRange.id}
            element={sapRange}
            typeName={sapRange.type?.label || sapRange.typeId}
            onClick={() => {
              if (props.onClick) {
                props.onClick(sapRange.id);
              }
            }}
            draggable={false}
          />
        </div>
      )}
      <DragDropContext
        onBeforeCapture={(e) => {
          setCollapseSpatialItems(true);
        }}
        onDragEnd={(result) => {
          setCollapseSpatialItems(false);
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
          {(provided, snapshot) => {
            const isDragging = snapshot.isDraggingOver;
            return (
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
                      <>
                        <FormElementListItem
                          collapseSpatialItems={collapseSpatialItems}
                          dim={props.dim}
                          typeId={element.typeId}
                          draggable={true}
                          provided={provided}
                          snapshot={snapshot}
                          key={element.id}
                          selectedId={props.selection}
                          selected={element.id === props.selection}
                          element={element}
                          typeName={element.type?.label || element.typeId}
                          creating={element.id === 9999999999}
                          onSpatialSubElementClick={(id) => {
                            if (props.onClick) {
                              props.onClick(id);
                            }
                          }}
                          onClick={() => {
                            if (props.onClick) {
                              props.onClick(element.id);
                            }
                          }}
                        />
                      </>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            );
          }}
        </Droppable>
      </DragDropContext>
      {thankYou && (
        <div className="mt-2">
          <FormElementListItem
            dim={props.dim}
            typeId={thankYou.typeId}
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
  typeId,
  dim,
  collapseSpatialItems,
  onSpatialSubElementClick,
  selectedId,
}: {
  element: FormElementFullDetailsFragment;
  typeName: string;
  typeId: string;
  onClick?: () => void;
  selected: boolean;
  provided?: DraggableProvided;
  draggable?: boolean;
  snapshot?: DraggableStateSnapshot;
  creating?: boolean;
  dim: boolean;
  collapseSpatialItems?: boolean;
  onSpatialSubElementClick?: (id: number) => void;
  selectedId?: number;
}) {
  const Component = components[typeId];
  if (!Component) {
    throw new Error(`No component implementation for ${typeId}?`);
  }
  const Icon = Component.icon;
  return (
    <div
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      style={provided?.draggableProps.style}
    >
      <div
        {...provided?.dragHandleProps}
        style={{ cursor: "pointer" }}
        onClick={onClick}
        className={`relative select-none cursor-pointer ${
          snapshot?.isDragging && "shadow-lg"
        } mx-2 h-11 ${
          draggable && "shadow-md"
        } bg-white w-50 border border-black border-opacity-20 rounded overflow-hidden ${
          selected && "ring-2 ring-blue-300"
        } ${creating ? "opacity-50" : ""}`}
      >
        {creating && <Spinner className="absolute right-1 top-1" />}
        <div className="w-full h-full flex items-center">
          <div
            className={`w-10 h-full`}
            style={{
              filter: dim ? "grayscale(40%)" : "",
            }}
          >
            <Icon
              componentSettings={element.componentSettings}
              sketchClass={element.sketchClass}
            />
          </div>
          <div className="truncate flex-1 px-2 text-sm">
            {collectQuestion(element.body) || collectHeaders(element.body)}
          </div>
        </div>
      </div>
      {!collapseSpatialItems &&
        element.sketchClass &&
        !!element.sketchClass?.form?.formElements?.length && (
          <div className="px-3 py-2">
            <SortableFormElementList
              selection={selectedId}
              items={element.sketchClass?.form?.formElements || []}
              dim={dim}
              onClick={(id) => {
                if (onSpatialSubElementClick) {
                  onSpatialSubElementClick(id);
                }
              }}
            />
          </div>
        )}
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
