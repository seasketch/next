# Report Widgets

Reporting widgets are blocks of content available to SeaSketch administrators to add to their sketch class report outputs. The system relies heavily on the (Prosemirror)[https://prosemirror.net/] rich content editor and document model. Each report is a collection of ReportCard components, each with it's own prosemirror document. What we call a SeaSketch Report Widget is really just a [Prosemirror Node Type](https://prosemirror.net/docs/guide/#schema), with a few important SeaSketch-specific details.

## Architecture

There are two different types of widgets. The first and simplest is actually not really a Report Widget at all, but rather a custom Prosemirror Node Type that is just integrated into the reportBodySchema found in `client/src/reports/widgets/prosemirror/`. See the `client/src/reports/widgets/prosemirror/details` schema for an example. These content types are implemented using prosemirror's standard dom-based view architecture, and added to the reportBodySchema. To have them show up in the report body editor, Commands need to be added to the slash command palette within `src/reports/hooks/useSlashCommandPalette`. For simple Prosemirror node-types that don't require React components or the metrics system, that's all you need.

True _Report Widgets_ are those which are rendered with React components and rely on the metric dependency system on the client for retrieving calculated metrics from the server. These are built on the existing prosemirror node types `metric` and `blockMetric`. While implementing a new Report Widget it's unlikely that you will need to interact with the prosemirror system, other than to call `insertInlineMetric` or `insertBlockMetric` with the appropriate arguments. Rather the work will be in implementing the React component, specifying the appropriate MetricDependency(s), and integrating it with the widget rendering system.

In short, Report Widgets have the following qualities and requirements:

- Rendered using a React component in `src/reports/widgets/` which extends the ReportWidget type and uses ReportWidgetProps.
- Uses the componentSettings prop/saved state to implement any admin-defined configuration options.
- Defines it's own `type` when inserted into the document using `insertInlineMetric` or `insertBlockMetric`. This is used to pick the appropriate widget renderer at runtime.
- Defines a static array of MetricDependency(s) (exported by overlay-engine) when inserted into the document. This is used by the system to request metric calculations and route the results to the component.
- New widgets need to be "wired in" to the report rendering and editing system by editing several components of `src/reports/widgets/widgets.tsx`.
  - They must be added to the switch statement at the end of `ReportWidgetNodeViewRouter` in to enable rendering.
  - One or more commands need to be added to `buildReportCommandGroups` in order to enable addition of these blocks to a report. This function is called with current contextual information like the project's geographies, sketchClassGeographyType, and available layers so that widgets may provide context-dependent commands so that administrators have "smart" recommendations.
  - Widgets can, and usually should, implement a `ReportWidgetTooltipControls` component in order to customize options stored in the componentSettings prop. These controls should use reusable components like `TooltipDropdown` exported by `src/editor/TooltipMenu.tsx` where possible. To enable these controls, updated the switch statement in `ReportWidgetTooltipControlsRouter` for the given Report Widget `type`.

For an example of how this all comes together, see the implementation of `src/reports/widgets/GeographySizeTable.tsx`.

## Admin Tooltip Controls Interface

Widgets are primarily configured using a tooltip menu. It is important to maintain consistency among these administrative tools as the number of widgets grows.

- Use common input controls defined in src/reports/widgets such as UnitSelector.tsx when you can. Don't reimplement the wheel all the time.
- Inputs should be organized into a set of inline controls on the tooltip when possible, but when there are too many and inputs form distinct groups, they may be broken out into popovers. Again, use reusable components such as those in src/editor/TooltipMenu.tsx rather than inventing your own.
- Each component's tooltip should have a TooltipMorePopover. These may contain extra settings that aren't often used, but most importantly each should indicate the component type (see FeaturePresenceTable for an example).

## Shared Table Widget Conventions

Several widgets render the same underlying "class table" pattern. To keep behavior consistent and avoid regressions:

- Build rows with `getClassTableRows()` and keep widget-specific metric decoration separate from row construction.
- Resolve layer visibility from both `row.stableId` and `componentSettings.rowLinkedStableIds` using the shared helpers in `ClassTableRows.ts`. Do not hand-roll this logic per widget.
- Prefer shared collection helpers like `useCollectionSketchExpand()` and `sketchContributionsForClassTableRow()` over widget-specific breakdown implementations.
- When primary geography context is required for metric combination, fail fast rather than silently substituting a sentinel id.
- Add focused tests around shared helpers and edge cases before copying table behavior into a new widget.

## Export Support (CSV/JSON)

Report widgets can participate in **client-side exports**. Export logic lives alongside widgets (client-side) so it stays consistent with the row/business logic already used for rendering.

### How exports work

- A report card’s ProseMirror body is walked for `metric` and `blockMetric` nodes.
- Each widget node has a `type` (the same `type` used by `ReportWidgetNodeViewRouter`).
- If a widget type has an exporter registered, the exporter produces one or more flat `WidgetExportSection`s:
  - `columns`: explicit column definitions
  - `rows`: plain records containing string/number/boolean/null values
  - optional `extras`: non-tabular payloads (e.g. histogram arrays) that are useful in JSON exports
- Inline metrics are exported via a **dedicated aggregator**: all `InlineMetric` nodes in a card are combined into a single “Inline metrics” section.

### Where export code lives

- Export framework: `src/reports/widgets/exports/`
  - `types.ts`: shared export contracts
  - `exportCard.ts`: orchestration / walking / packaging entry point
  - `registry.ts`: widget exporter registry keyed by widget `type`
  - `csv.ts`: CSV serialization (PapaParse)
  - `package.ts`: CSV packaging (always zipped)
  - `json.ts` + `raw.ts`: JSON envelope + normalized raw context/metrics
- Widget exporters: `src/reports/widgets/exports/exporters/`

### Adding export support for a new widget

1) **Write an exporter**

- Create a new exporter file under `src/reports/widgets/exports/exporters/`.
- Export a `WidgetExporter` function that returns `WidgetExportSection[]`.
- Prefer reusing existing helpers used by the widget UI (e.g. `combineMetricsForFragments`, `getClassTableRows`, collection helpers) rather than re-deriving logic.
- For reference, see:
  - `src/reports/widgets/exports/exporters/geographySizeTable.export.ts` (simple table + collection sketch breakdown)
  - `src/reports/widgets/exports/exporters/classTableWidgets.export.ts` (class-table pattern: overlap/count/presence/raster proportion)
  - `src/reports/widgets/exports/exporters/inlineMetrics.export.ts` (inline metric aggregation into a single wide section)

2) **Register the exporter**

- Add the widget exporter to `src/reports/widgets/exports/registry.ts` using the widget’s `type` string as the key (must match the ProseMirror node attrs `type` / router type).

3) **Conform to export conventions**

- **Scope rows (collections)**: When exporting collection-aware widgets, include a `scope` column with at least:
  - `collection`: aggregate rows
  - `sketch`: per-child-sketch rows (when the report subject is a collection)
- **Full-stats policy**: Export should include the full metric payload fields available (even if the widget UI hides some fields via settings).
- **Stable / readable CSV columns**:
  - CSV headers come from column `key`s, so keep keys concise and readable.
  - Avoid leaking internal identifiers unless they are required for downstream joins.
- **InlineMetric**:
  - Do not implement per-inline-metric CSV sections.
  - Add new InlineMetric presentations by updating the inline aggregator exporter.

### Export filenames & packaging

- **CSV** exports are always returned as a **zip**, even for a single section, to keep naming consistent and include an optional manifest.
- **Single-card exports** use a base filename like:
  - `{sketchId}-{slugified(sketchName)}-{slugified(cardTitle)}-{cardId}`
- **Whole-report exports** (when implemented) use a base filename like:
  - `{sketchId}-{slugified(sketchName)}-report-{reportId}`

### JSON exports and raw payload

JSON exports include:
- `sections[]`: the primary flattened, consumable data
- `raw`: normalized context and exact metric payloads (for debugging / advanced downstream usage)

The `raw` payload intentionally strips GraphQL-only noise such as `__typename`, and uses friendly fields (e.g. `sourceTitle`) rather than leaking URLs where possible.
