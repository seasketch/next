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
