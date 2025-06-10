# Fragments

Fragments are a concept being introduced with the new graphical report building tools and associated overlay system. They provide a way to create a static representation of the components of a sketch geometry in the database, where a user-drawn polygon is split into pieces that belong to one or more Geographies. This results in a set of single-part polygons that can be fed into the overlay engine to generate metrics on overlap with key datasets, without ever calculating the same information twice.

To better understand the use case, consider this example: We are planning to do nearshore planning in the Azores. The process intends to protect 30% of nearshore waters, but stakeholders also want to protect about 30% of the waters surrounding each island. Furthermore, we may combine the nearshore and offshore MPA plans into a network to evaluate whether 30% of the entire Azorean EEZ is protected. In SeaSketch, our reports will need to visualize whether MPA network candidates protect key habitats in each of these different Geographies.

In the past, if we wanted to compute a metric like _Percent Rocky Reef_ protected within 9 different islands’ waters, the entire nearshore zone, and all Azorean waters, we would need to run 11 separate calculations. Each time, the user polygon would be clipped to each geography and overlaid with each dataset of interest. To save time, the MPA network as a whole was typically evaluated in aggregate, rather than calculating results for each geography individually. But this meant every change to an MPA network required recalculating everything—making updates slow and hard to parallelize. Even minor edits could result in multi-minute delays for new report results.

Fragments change this substantially. Upon submitting a new Sketch, the system immediately splits the polygon into one or more Fragments, each associated with one or more Geographies. You can think of this as a [Union operation](https://pro.arcgis.com/en/pro-app/latest/tool-reference/analysis/how-union-analysis-works.htm), assigning each shard of the polygon to overlapping Geographies.

These Fragments (stored in Postgres) have the following useful properties:

1. **Stable Identity**  
   Each has a geometry hash that acts as a primary key, enabling reuse and deduplication.

2. **Many-to-Many Sketch Relationships**  
   The relationship between Fragments and Sketches is via a many-to-many table. Sketch copies with the same geometry refer to the same Fragments. Even independently created sketches with matching geometry in the same Geographies will point to the same Fragments. No redundant metric calculations are needed.

3. **Overlap-aware**  
   When Sketches in a Collection overlap, the union is recalculated. Overlapping
   regions will refer to shared Fragments; non-overlapping areas remain
   distinct.

4. **Don't span the antimeridia**
   Polygons that span the antimeridian are split into two Fragments, making for
   one less thing for downstream operations to worry about.

5. **Organize Reporting**  
   Fragments make a reporting "Query Planner" possible, to determine which
   metrics for which fragments need to be run (or have already been cached).

   - A habitat report would run overlay analysis per fragment, which can be processed in parallel (e.g. via Lambda).
   - Metric results (e.g. sq meters of habitat _x_) are stored with references to fragment and metric ID.
   - Per-Sketch results are simply the sum of associated Fragments.
   - For Collection-level reports, previously computed MPA-level metrics can be summed—no need to redo overlay analysis.

6. **Cache and Clean-up Friendly**  
   Metrics can be efficiently cached using foreign keys. Use cascading delete constraints to remove dependent metrics when Fragments are deleted. Triggers can remove orphaned Fragments no longer referenced by any Sketch.

## Generating Fragments

Fragments are created by running a [Union operation](https://pro.arcgis.com/en/pro-app/latest/tool-reference/analysis/how-union-analysis-works.htm) against all relevant Geographies in the project.

A Geography is considered relevant if:

- It is used for clipping the Sketch (via the `sketch_class_geographies` table), **or**
- It is referenced by the Sketch Class’s report configuration (e.g. grouping area captured by bioregions)

> **Warning**  
> Clipping and reporting configurations can change over time, and Geographies may be deleted, created, or updated. Fragment generation must account for these changes.

## Tests

The following are the important scenarios to unit test.

- Fragments can be created and associated with a sketch using the
  update_sketch_fragments stored procedure.
  - verify that the appropriate records are created
- update_sketch_fragments should limit access to only the owner of the given sketch.
- Two sketches with the same geometry submitted to update_sketch_fragments
  should share the same fragment(s)
- Copying a sketch should produce a copy that refers to the same fragment(s)
- Deleting a sketch should delete it's fragments (assuming it doesn't overlap
  other sketches)
- Deleting the original sketch after creating a copy does not delete the
  fragment(s), since the copy refers to it.
- It should not be possible to call update_sketch_fragments with a geometry that
  overlaps the antimeridian, and the error message should be explicit about that.
