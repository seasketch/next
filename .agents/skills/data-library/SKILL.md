---
name: data-library
description: >
  Stamp a SeaSketch data-library template id onto a superuser layer so the
  Data Library, geography wizard, Coral Reef Watch job, and distance-to-port
  commands can find it. Use when assigning data_library_template_id, calling
  assign_data_library_template_id, adding or renaming a Data Library card
  (WORLD_PORTS, GLOBAL_MANGROVE_WATCH, CRW_ROOT, and the other template ids),
  or when a production stable id should match one of those strings.
---

# Data library template ids

Read and follow [packages/api/src/DataLibrary/README.md](../../../packages/api/src/DataLibrary/README.md).

The code looks up a fixed string, not a stable id. Production and the golden snapshot use different stable ids for the same template. Stamp the draft `superuser` layer:

```sql
select assign_data_library_template_id('<draft stable id>', 'WORLD_PORTS');
```

`assign_data_library_template_id` is not in the GraphQL API. Run it as a database superuser. The string has to be one the client or a job already uses (`WORLD_PORTS`, `GLOBAL_MANGROVE_WATCH`, `CRW_ROOT`, the geography ids, and the rest listed in the README). The column is unique.

That call sets `data_library_template_id` on the draft table-of-contents row and on its data source. Project copies made afterward store the same string in `copied_from_data_library_template_id`, which is the column the client can see. Copies made before the stamp do not.

Do not insert the rest of the production catalog into the golden snapshot. Seeded ids live in `packages/api/src/DataLibrary/snapshotTemplateIds.js`. Changing that set is a golden-snapshot update, not a production stamp.
