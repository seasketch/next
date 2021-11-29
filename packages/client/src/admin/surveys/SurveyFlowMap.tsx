import {
  FieldRuleOperator,
  FormElement,
  FormElementDetailsFragment,
  FormElementFullDetailsFragment,
  FormLogicCondition,
  FormLogicRule,
  LogicRuleDetailsFragment,
  Maybe,
  SketchGeometryType,
} from "../../generated/graphql";
import { components } from "../../formElements";
import ReactFlow, {
  removeElements,
  addEdge,
  MiniMap,
  Controls,
  Background,
  Elements,
  isNode,
  Position,
  Handle,
  ArrowHeadType,
} from "react-flow-renderer";
import dagre from "dagre";
import { collectHeaders, collectQuestion, collectText } from "./collectText";
import {
  defaultFormElementIcon,
  sortFormElements,
} from "../../formElements/FormElement";
import { FunctionComponent, memo, useMemo } from "react";
import { OPERATOR_LABELS } from "./LogicRuleEditor";
import { Trans } from "react-i18next";
import { Icons } from "../../components/SketchGeometryTypeSelector";

type Rule = LogicRuleDetailsFragment;

export default function SurveyFlowMap({
  formElements,
  onSelection,
  rules,
  primaryFormId,
}: {
  primaryFormId: number;
  formElements: FormElementFullDetailsFragment[];
  rules: Rule[];
  onSelection?: (formElementId: number[]) => void;
}) {
  const flowElements = useMemo(() => {
    if (formElements) {
      return getReactFlowElements(formElements, rules, primaryFormId);
    } else {
      return [];
    }
  }, [formElements, rules]);

  // const formElements = sortFormElements([
  //   ...(data?.survey?.form?.formElements || []),
  // ]);

  if (formElements.length === 0) {
    return null;
  }
  return (
    <ReactFlow
      nodeTypes={nodeTypes}
      maxZoom={1.1}
      minZoom={0.1}
      elementsSelectable={true}
      nodesConnectable={false}
      nodesDraggable={true}
      onConnect={(params) => {}}
      onSelectionChange={(elements) => {
        if (onSelection) {
          onSelection(elements ? elements.map((e) => parseInt(e.id)) : []);
        }
      }}
      // multiSelectionKeyCode={"meta"}
      onLoad={(params) => {
        // setTimeout(() => {
        params.fitView({
          padding: 0.15,
          minZoom: 0.6,
        });
        // }, 10);
      }}
      elements={flowElements}
      // snapToGrid={true}
    >
      <Controls />
    </ReactFlow>
  );
}

const maxWidth = 340;
const nodeHeight = 36;
const nodeWidth = (label: string, parent: boolean) =>
  Math.min(label.length * 9.5 + (parent ? 110 : 57), maxWidth);
function getReactFlowElements(
  formElements: FormElementFullDetailsFragment[],
  rules: Rule[],
  primaryFormId: number,
  direction = "TB"
): Elements<any> {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({
    rankdir: direction,
    marginx: 40,
    marginy: 40,
    // nodesep: 100,
    // edgesep: 70,
  });
  const elements: Elements<any> = getElementsForForm(
    primaryFormId,
    formElements,
    rules
  );
  elements.forEach((el) => {
    if (isNode(el)) {
      dagreGraph.setNode(el.id, {
        width: nodeWidth(el.data.label, !!el.data.ParentIcon),
        height: nodeHeight,
      });
    } else {
      dagreGraph.setEdge(el.source, el.target);
    }
  });

  dagre.layout(dagreGraph);

  const sources = dagreGraph.sources();

  // @ts-ignore
  window.graph = dagreGraph;

  return elements.map((el) => {
    if (isNode(el)) {
      const nodeWithPosition = dagreGraph.node(el.id);
      el.targetPosition = isHorizontal ? Position.Left : Position.Top;
      el.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

      // unfortunately we need this little hack to pass a slightly different position
      // to notify react flow about the change. Moreover we are shifting the dagre node position
      // (anchor=center center) to the top left so it matches the react flow node anchor point (top left).
      el.position = {
        x:
          nodeWithPosition.x -
          nodeWidth(el.data.label, !!el.data.ParentIcon) / 2 +
          Math.random() / 1000,
        y: nodeWithPosition.y - nodeHeight / 2,
      };
      el.data.isSource = sources.indexOf(el.data.id.toString()) !== -1;
    }

    return el;
  });
}

function getElementsForForm(
  formId: number,
  formElements: FormElementFullDetailsFragment[],
  rules: LogicRuleDetailsFragment[],
  parentId?: number,
  parentSpatialType?: SketchGeometryType,
  isMultiSpatial?: boolean
): Elements<any> {
  const elements: Elements<any> = [];
  const sortedElements = sortFormElements(
    formElements.filter((f) => f.formId === formId)
  );
  for (const formElement of sortedElements) {
    const label = formElement.type?.isInput
      ? collectQuestion(formElement.body)
      : collectHeaders(formElement.body, 18);
    elements.push({
      // type: formElement.type?.isInput ? "question" : "statement",
      type: "formElement",
      id: formElement.id.toString(),
      position: { x: 0, y: 0 },
      // selectable: formElement.type?.isInput,
      data: {
        ...formElement,
        label,
        type: formElement.typeId,
        typeLabel: formElement.type?.label,
        isRequired: formElement.isRequired,
        isInput: formElement.type?.isInput,
        id: formElement.id,
        isSource: false,
        ParentIcon: parentId
          ? components[formElements.find((f) => f.id === parentId)!.typeId]!
              .icon
          : undefined,
      },
      // className: "shadow max-w-md whitespace-nowrap overflow-hidden truncate",
      style: {
        width: nodeWidth(label, !!parentId),
      },
    });
    const index = sortedElements.indexOf(formElement);
    const applicableRules = rules.filter(
      (r) => r.formElementId === formElement.id && r.jumpToId
    );
    if (formElement.sketchClass?.form?.formElements?.length) {
      const subElements = getElementsForForm(
        formElement.sketchClass.form.id,
        formElements,
        rules,
        formElement.id,
        formElement.sketchClass.geometryType,
        formElement.typeId !== "SingleSpatialInput"
      );
      elements.push(...subElements);
      // Connect current form element to subform
      elements.push({
        // eslint-disable-next-line i18next/no-literal-string
        id: `eRoot${formElement.id}`,
        position: { x: 0, y: 0 },
        source: formElement.id.toString(),
        target: subElements[0].id,
        // arrowHeadType: ArrowHeadType.ArrowClosed,
        // animated: true,
        // label: applicableRules.length ? "default" : undefined,
      });
      const nextQuestion =
        formElement.jumpToId?.toString() ||
        sortedElements[index + 1].id.toString();
      // connect end of sub-form to next form element
      if (subElements[subElements.length - 1].data.jumpToId === null) {
        elements.push({
          // eslint-disable-next-line i18next/no-literal-string
          id: `eFinish${formElement.id}`,
          position: { x: 0, y: 0 },
          source: subElements[subElements.length - 1].id.toString(),
          target: nextQuestion,
          arrowHeadType: ArrowHeadType.ArrowClosed,
          // label: applicableRules.length ? "default" : undefined,
        });
      }
      // connect any jumpTo -> parent links to the next question
      for (const subElement of subElements.filter((el) => isNode(el))) {
        const applicableRules = rules.filter(
          (r) => r.formElementId === subElement.data.id
        );
        if (subElement.data.jumpToId === formElement.id) {
          elements.push({
            // eslint-disable-next-line i18next/no-literal-string
            id: `eFinish${formElement.id}-${subElement.id}`,
            position: { x: 0, y: 0 },
            source: subElement.id,
            target: nextQuestion,
            arrowHeadType: ArrowHeadType.ArrowClosed,
            label: applicableRules.length ? "default" : undefined,
          });
        }
        for (const rule of applicableRules) {
          if (rule.jumpToId === formElement.id) {
            elements.push({
              // type: "smoothstep",
              // eslint-disable-next-line i18next/no-literal-string
              id: `e${formElement.id}-r${rule.id}`,
              position: { x: 0, y: 0 },
              source: subElement.id.toString(),
              target: nextQuestion,
              arrowHeadType: ArrowHeadType.ArrowClosed,
              label:
                (rule.conditions || [])
                  .map((condition) =>
                    condition.operator === FieldRuleOperator.IsBlank
                      ? `${OPERATOR_LABELS[condition.operator]}`
                      : `${OPERATOR_LABELS[condition.operator]} ${
                          condition.value
                        }`
                  )
                  .join(", ") || "",
            });
          }
        }
      }
    } else if (formElement.sketchClass) {
      // Sketch Class with no form elements (singlespatialinput?)
      const nextQuestion =
        formElement.jumpToId?.toString() ||
        sortedElements[index + 1].id.toString();
      // connect end of sub-form to next form element
      elements.push({
        // eslint-disable-next-line i18next/no-literal-string
        id: `eFinish${formElement.id}`,
        position: { x: 0, y: 0 },
        source: formElement.id.toString(),
        target: nextQuestion,
        arrowHeadType: ArrowHeadType.ArrowClosed,
        // label: applicableRules.length ? "default" : undefined,
      });
    }

    if (index < sortedElements.length - 1 && !formElement.sketchClass?.form) {
      if (!formElement.jumpToId || formElement.jumpToId !== parentId) {
        elements.push({
          // type: "smoothstep",
          // eslint-disable-next-line i18next/no-literal-string
          id: `e${formElement.id}`,
          position: { x: 0, y: 0 },
          source: formElement.id.toString(),
          target:
            formElement.jumpToId?.toString() ||
            sortedElements[index + 1].id.toString(),
          // animated: !!parentId,
          arrowHeadType: ArrowHeadType.ArrowClosed,
          label: applicableRules.length ? "default" : undefined,
        });
      }
      for (const rule of applicableRules) {
        if (rule.jumpToId !== parentId) {
          elements.push({
            // type: "smoothstep",
            // eslint-disable-next-line i18next/no-literal-string
            id: `e${formElement.id}-r${rule.id}`,
            position: { x: 0, y: 0 },
            source: formElement.id.toString(),
            target: rule.jumpToId!.toString(),
            arrowHeadType: ArrowHeadType.ArrowClosed,
            label:
              (rule.conditions || [])
                .map((condition) =>
                  condition.operator === FieldRuleOperator.IsBlank
                    ? `${OPERATOR_LABELS[condition.operator]}`
                    : `${OPERATOR_LABELS[condition.operator]} ${
                        condition.value
                      }`
                )
                .join(", ") || "",
          });
        }
      }
    }
  }
  return elements;
}

const nodeTypes = {
  formElement: memo<{
    data: {
      label: string;
      type: string;
      typeLabel: string;
      isRequired: boolean;
      isInput: boolean;
      isSource: boolean;
      ParentIcon: FunctionComponent;
    } & FormElementFullDetailsFragment;
  }>((d) => {
    // @ts-ignore
    const { data, selected } = d;
    const orphan = data.isSource && data.type !== "WelcomeMessage";
    const Icon = components[data.type]!.icon;
    return (
      <>
        {data.type !== "WelcomeMessage" && (
          <>
            <Handle
              type="target"
              position={Position.Top}
              style={{ opacity: 0 }}
              isConnectable={false}
            />
            <Handle
              type="target"
              position={Position.Right}
              style={{ opacity: 0 }}
              isConnectable={false}
            />
            <Handle
              type="target"
              position={Position.Left}
              style={{ opacity: 0 }}
              isConnectable={false}
            />
          </>
        )}

        <div
          className={`relative ${
            orphan ? "ring-red-500 ring-1" : ""
          } bg-white rounded shadow flex w-full cursor-pointer ${
            selected ? (orphan ? "ring-2" : "ring-2 ring-blue-300") : ""
          }`}
        >
          {orphan && (
            <div className="absolute left-1/3 -top-6 bg-red-500 text-white px-1 font-medium">
              <Trans ns="admin:surveys">always skipped</Trans>
            </div>
          )}
          {data.ParentIcon && (
            <div className={`h-10 w-10 rounded-l overflow-hidden relative`}>
              <data.ParentIcon />
            </div>
          )}
          <div
            className={`h-10 w-10 overflow-hidden relative ${
              !!data.ParentIcon ? "bg-red-500 p-1 -ml-1" : "rounded-l"
            }`}
          >
            <div
              className={`${
                !!data.ParentIcon ? "rounded" : ""
              } h-full w-full overflow-hidden`}
            >
              <Icon
                componentSettings={data.componentSettings}
                sketchClass={data.sketchClass}
              />
            </div>
          </div>
          <h3 className="w-full truncate text-base text-center px-4 py-2 flex-1">
            {data.label}
            {data.isRequired ? "*" : ""}
          </h3>
        </div>
        {/* <Handle
          type="source"
          position={Position.Bottom}
          id="a"
          style={{ top: 10, background: "#555" }}
          isConnectable={false}
        /> */}
        {data.type !== "ThankYou" && (
          <>
            <Handle
              type="source"
              position={Position.Bottom}
              id="b"
              style={{ opacity: 0 }}
              className="bottom-0"
              // style={{ bottom: 10, top: "auto", background: "#555" }}
              isConnectable={false}
            />
            {/* <Handle
              type="source"
              position={Position.Left}
              id="l"
              // style={{ opacity: 0 }}
              className="left-0"
              isConnectable={false}
            />
            <Handle
              type="source"
              position={Position.Right}
              id="r"
              // style={{ opacity: 0 }}
              className="right-0"
              isConnectable={false}
            /> */}
          </>
        )}
      </>
    );
  }),
};
