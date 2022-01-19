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
import {
  defaultFormElementIcon,
  sortFormElements,
} from "../../formElements/FormElement";
import { Trans, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import AddFormElementButton from "./AddFormElementButton";
import { useHistory } from "react-router-dom";

interface Props {
  items: FormElementFullDetailsFragment[];
  selection?: number;
  onClick?: (id: number) => void;
  onReorder?: (sortedIds: number[]) => void;
  className?: CSSProperties;
  dim: boolean;
  onAddClick?: (formId: number) => void;
  subordinateTo?: FormElementFullDetailsFragment;
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
  const [collapseSpatialItems, setCollapseSpatialItems] = useState(false);
  const welcome = props.items.find((i) => i.typeId === "WelcomeMessage");
  const thankYou = props.items.find((i) => i.typeId === "ThankYou");
  const featureName = props.items.find((i) => i.typeId === "FeatureName");
  const sapRange = props.items.find((i) => i.typeId === "SAPRange");
  const saveScreen = props.items.find((i) => i.typeId === "SaveScreen");
  const sortableFormElements = sortFormElements(props.items).filter(
    (i) =>
      i.typeId !== "WelcomeMessage" &&
      i.typeId !== "ThankYou" &&
      i.typeId !== "FeatureName" &&
      i.typeId !== "SAPRange" &&
      i.typeId !== "SaveScreen"
  );

  if (!props.items.length) {
    return null;
  }

  const startItems = [welcome].filter(
    (el) => !!el
  ) as FormElementFullDetailsFragment[];
  const finishItems = [saveScreen, thankYou].filter(
    (el) => !!el
  ) as FormElementFullDetailsFragment[];

  const allSortedFormElements = [
    ...startItems,
    ...sortableFormElements,
    ...finishItems,
  ];

  return (
    <div className={`pb-4 pt-1 ${props.className}`}>
      <div className="mb-2">
        {startItems.map((el) => (
          <FormElementListItem
            key={el.id}
            dim={props.dim}
            typeId={el.typeId}
            selected={props.selection === el.id}
            element={el}
            typeName={el.type?.label || el.typeId}
            onClick={() => {
              if (props.onClick) {
                props.onClick(el.id);
              }
            }}
            draggable={false}
          />
        ))}
      </div>
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
          const inSubordinateForm = props.subordinateTo;
          setCollapseSpatialItems(false);
          if (!result.destination) {
            return;
          } else {
            let sorted = reorder(
              sortableFormElements.filter((el) =>
                inSubordinateForm
                  ? el.subordinateTo === props.subordinateTo!.id
                  : !el.subordinateTo
              ),
              result.source.index,
              result.destination.index
            );
            if (!inSubordinateForm) {
              const finalSorted = [...startItems];
              for (const item of sorted) {
                finalSorted.push(item);
                const subordinateItems = sortableFormElements.filter(
                  (el) => el.subordinateTo === item.id
                );
                if (subordinateItems.length) {
                  finalSorted.push(...subordinateItems);
                }
              }
              // sorted = [...startItems, ...sorted, ...finishItems];
              sorted = [...finalSorted, ...finishItems];
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
                {sortableFormElements
                  .filter(
                    (el) =>
                      !el.subordinateTo ||
                      el.subordinateTo === props.subordinateTo?.id
                  )
                  .map((element, i) => (
                    <Draggable
                      index={i}
                      draggableId={element.id.toString()}
                      key={element.id}
                      isDragDisabled={element.typeId === "WelcomeMessage"}
                    >
                      {(provided, snapshot) => (
                        <>
                          <FormElementListItem
                            onReorder={props.onReorder}
                            collapseSpatialItems={collapseSpatialItems}
                            dim={props.dim}
                            typeId={element.typeId}
                            formElements={allSortedFormElements}
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
      {finishItems.map((el) => (
        <div key={el.id} className="my-2">
          <FormElementListItem
            dim={props.dim}
            typeId={el.typeId}
            selected={props.selection === el.id}
            element={el}
            typeName={el.type?.label || el.typeId}
            onClick={() => {
              if (props.onClick) {
                props.onClick(el.id);
              }
            }}
            draggable={false}
          />
        </div>
      ))}
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
  onReorder,
  onAddClick,
  formElements,
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
  onReorder?: (elements: number[]) => void;
  onAddClick?: (elementId: number) => void;
  formElements?: FormElementFullDetailsFragment[];
}) {
  const { t } = useTranslation("admin:surveys");
  const history = useHistory();
  const Component = components[typeId];
  if (!Component) {
    throw new Error(`No component implementation for ${typeId}?`);
  }
  const Icon = Component.icon;
  if (element.sketchClass && !onReorder) {
    throw new Error(
      "onReorder not specified for FormElement with a sketchclass"
    );
  }
  const subordinateFormElements = (formElements || []).filter(
    (el) => el.subordinateTo === element.id
  );
  if (subordinateFormElements.length && !onReorder) {
    throw new Error(
      "onReorder not specified for FormElement with subordinate elements"
    );
  }

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
        element.typeId === "SpatialAccessPriorityInput" && (
          <>
            <div className="px-1 py-1 border-cool-gray-300 border-2 rounded m-4">
              <h4 className="uppercase text-xs text-center text-cool-gray-400 font-semibold py-1">
                <Trans ns="admin:surveys">Spatial Attributes</Trans>
              </h4>
              <SortableFormElementList
                selection={selectedId}
                items={element.sketchClass?.form?.formElements || []}
                dim={dim}
                onClick={(id) => {
                  if (onSpatialSubElementClick) {
                    onSpatialSubElementClick(id);
                  }
                }}
                onReorder={onReorder}
              />
              <div className="flex justify-center pb-1 -mt-1">
                <AddFormElementButton
                  formIsSketchClass={true}
                  nextPosition={
                    (element.sketchClass?.form?.formElements?.length || 0) + 1
                  }
                  formId={element.sketchClass!.form!.id}
                  heading={t("Add to spatial input...")}
                  onAdd={(formElement) => history.replace(`./${formElement}`)}
                  existingTypes={(
                    element.sketchClass?.form?.formElements || []
                  ).map((el) => el.typeId)}
                  label={t("Add element")}
                />
              </div>
            </div>
            <div className="px-1 py-1 border-cool-gray-300 border-2 rounded m-4">
              <h4 className="uppercase text-xs text-center text-cool-gray-400 font-semibold py-1">
                <Trans ns="admin:surveys">Sector-Specific Questions</Trans>
              </h4>
              <SortableFormElementList
                subordinateTo={element}
                selection={selectedId}
                items={subordinateFormElements}
                dim={dim}
                onClick={(id) => {
                  if (onSpatialSubElementClick) {
                    onSpatialSubElementClick(id);
                  }
                }}
                onReorder={(sortedIds) => {
                  if (!formElements) {
                    throw new Error(
                      "formElements prop not set for sector-specific questions"
                    );
                  }
                  const parent = element;
                  const parentIndex = formElements.indexOf(element);
                  // For nested, subordinate elements, this sorting logic gets pretty complicated
                  const beforeParent = formElements
                    .slice(0, parentIndex)
                    .map((el) => el.id);
                  const afterParent = formElements
                    .slice(parentIndex + 1)
                    .map((el) => el.id);
                  sortedIds = [
                    ...beforeParent,
                    parent.id,
                    ...sortedIds,
                    ...afterParent,
                  ];
                  if (onReorder) {
                    onReorder(sortedIds);
                  }
                }}
              />
              <div className="flex justify-center pb-1 -mt-1">
                <AddFormElementButton
                  formIsSketchClass={false}
                  nextPosition={
                    (element.sketchClass?.form?.formElements?.length || 0) + 1
                  }
                  formId={element.formId}
                  heading={t("Add to sector questions...")}
                  onAdd={(formElement) => history.replace(`./${formElement}`)}
                  existingTypes={subordinateFormElements.map((el) => el.typeId)}
                  label={t("Add element")}
                  subordinateTo={element.id}
                />
              </div>
            </div>
          </>
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
