import {
  FieldRuleOperator,
  FormElement,
  FormLogicCondition,
  FormLogicRule,
  Maybe,
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
import { memo, useMemo } from "react";
import { OPERATOR_LABELS } from "./LogicRuleEditor";
import { Trans } from "react-i18next";

type FE = Pick<
  FormElement,
  "id" | "body" | "position" | "typeId" | "isRequired" | "jumpToId"
> & {
  type?: Maybe<{ isInput: boolean; label: string }> | undefined;
};

type Rule = Pick<
  FormLogicRule,
  "jumpToId" | "command" | "formElementId" | "id"
> & {
  conditions?: Maybe<
    Pick<FormLogicCondition, "id" | "operator" | "value" | "subjectId">[]
  >;
};

export default function SurveyFlowMap({
  formElements,
  onSelection,
  rules,
}: {
  formElements: FE[];
  rules: Rule[];
  onSelection?: (formElementId: number[]) => void;
}) {
  const flowElements = useMemo(() => {
    if (formElements) {
      return getReactFlowElements(sortFormElements([...formElements]), rules);
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
      nodesDraggable={false}
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

const maxWidth = 380;
const nodeHeight = 36;
const nodeWidth = (label: string) => Math.min(label.length * 9 + 57, maxWidth);
function getReactFlowElements(
  formElements: FE[],
  rules: Rule[],
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
  const elements: Elements<any> = [];
  for (const formElement of formElements) {
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
        label,
        type: formElement.typeId,
        typeLabel: formElement.type?.label,
        isRequired: formElement.isRequired,
        isInput: formElement.type?.isInput,
        id: formElement.id,
        isSource: false,
      },
      // className: "shadow max-w-md whitespace-nowrap overflow-hidden truncate",
      style: {
        width: nodeWidth(label),
      },
    });
    const index = formElements.indexOf(formElement);
    const applicableRules = rules.filter(
      (r) => r.formElementId === formElement.id && r.jumpToId
    );
    if (index < formElements.length - 1) {
      elements.push({
        // type: "smoothstep",
        // eslint-disable-next-line i18next/no-literal-string
        id: `e${formElement.id}`,
        position: { x: 0, y: 0 },
        source: formElement.id.toString(),
        target:
          formElement.jumpToId?.toString() ||
          formElements[index + 1].id.toString(),
        arrowHeadType: ArrowHeadType.ArrowClosed,
        label: applicableRules.length ? "default" : undefined,
      });
      for (const rule of applicableRules) {
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
                  : `${OPERATOR_LABELS[condition.operator]} ${condition.value}`
              )
              .join(", ") || "",
        });
      }
    }
  }
  elements.forEach((el) => {
    if (isNode(el)) {
      dagreGraph.setNode(el.id, {
        width: nodeWidth(el.data.label),
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
          nodeWidth(el.data.label) / 2 +
          Math.random() / 1000,
        y: nodeWithPosition.y - nodeHeight / 2,
      };
      el.data.isSource = sources.indexOf(el.data.id.toString()) !== -1;
    }

    return el;
  });
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
    };
  }>((d) => {
    // @ts-ignore
    const { data, selected } = d;
    const orphan = data.isSource && data.type !== "WelcomeMessage";
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
          <div className="h-10 w-12 rounded-l overflow-hidden">
            {components[data.type]?.icon || defaultFormElementIcon}
          </div>
          <h3 className="w-full truncate text-base text-center px-4 py-2 ">
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
