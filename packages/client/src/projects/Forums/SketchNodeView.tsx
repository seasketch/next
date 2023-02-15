import ForumTreeView from "./ForumTreeView";
import { useReactNodeView } from "./ReactNodeView";

export default function SketchNodeView(props: any) {
  const context = useReactNodeView();
  return <ForumTreeView items={context.node?.attrs.items || []} />;
}
