import {
  SketchFolderDetailsFragment,
  SketchTocDetailsFragment,
} from "../../generated/graphql";

export default function SketchTableOfContents({
  sketches,
  folders,
}: {
  sketches: SketchTocDetailsFragment[];
  folders: SketchFolderDetailsFragment[];
}) {
  return (
    <ul className="px-2 py-1">
      {folders.map((f) => (
        <li key={f.id}>
          <input type="checkbox" className="mr-2 rounded" />
          <span className="text-sm">{f.name}</span>
        </li>
      ))}
      {sketches.map((s) => (
        <li key={s.id}>
          <input type="checkbox" className="mr-2 rounded" />
          <span className="text-sm">{s.name}</span>
        </li>
      ))}
    </ul>
  );
}
