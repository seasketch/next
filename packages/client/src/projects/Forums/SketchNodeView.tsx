import { useContext } from "react";
import ForumTreeView from "./ForumTreeView";
import { useReactNodeView } from "./ReactNodeView";
import { ReactNodeViewPortalsContext } from "./ReactNodeView/PortalProvider";

export default function SketchNodeView(props: any) {
  const context = useReactNodeView();
  return <ForumTreeView items={context.node?.attrs.items || []} />;
}
