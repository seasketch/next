# Data library template ids

The client and the library jobs find a layer by a fixed string, `data_library_template_id`. They do not find it by stable id. Stable ids differ between production and the golden snapshot. The string has to match the code exactly.

## Where the id is stored

| Column | Which rows | What reads it |
| --- | --- | --- |
| `table_of_contents_items.data_library_template_id` | The draft template in the `superuser` project. Unique. Omitted from GraphQL (`@omit`). | `copy_data_library_template_item` and `getTemplateDetails` |
| `data_sources.data_library_template_id` | That template's current data source. `replace_data_source` stamps the same string on the replacement source. | Live fan-out when the template source is replaced |
| `table_of_contents_items.copied_from_data_library_template_id` | Project copies, draft and published. This is the column the client can see. | Distance to port, and anything else that matches `copiedFromDataLibraryTemplateId` |

`copy_data_library_template_item` copies the template's `data_library_template_id` into the copy's `copied_from_data_library_template_id`. It does not copy `data_library_template_id` itself. That column stays unique to the draft template.

## Stamp a layer that already exists

The layer has to be a draft table-of-contents item in the `superuser` project. `assign_data_library_template_id` is not in the GraphQL API. Run it as a database superuser:

```sql
select assign_data_library_template_id('<draft stable id>', 'WORLD_PORTS');
```

Use the template id from the table below, not a new name. The function sets `data_library_template_id` on that draft row and on the data source behind it. It leaves the published row alone.

The column is unique. Check for an existing stamp before assigning one:

```sql
select stable_id, title, is_draft, data_library_template_id
from table_of_contents_items
where data_library_template_id = 'WORLD_PORTS'
   or stable_id = '<draft stable id>';
```

Confirm both the draft item and its source:

```sql
select
  t.stable_id,
  t.is_draft,
  t.data_library_template_id as toc_template_id,
  s.data_library_template_id as source_template_id
from table_of_contents_items t
join data_layers l on l.id = t.data_layer_id
join data_sources s on s.id = l.data_source_id
where t.stable_id = '<draft stable id>'
  and t.is_draft;
```

Both template columns should be the same string.

Copies added from the Data Library after the stamp get `copied_from_data_library_template_id`. Copies made before the stamp do not. Distance to port only sees a copy that has that column set. Re-add the layer from the Data Library, or set `copied_from_data_library_template_id` on those existing copies, when those projects should pick the layer up.

## Ids the code looks up

Data Library cards pass these strings to `copy_data_library_template_item` (`packages/client/src/admin/data/DataLibraryModal.tsx`):

| Template id | Card |
| --- | --- |
| `CRW_ROOT` | NOAA Coral Reef Watch |
| `EBSA` | Ecologically or Biologically Significant Marine Areas |
| `BLUE_HABITATS` | Blue Habitats seafloor geomorphic features |
| `GLOBAL_MANGROVE_WATCH` | Global Mangrove Watch |
| `HYDROTHERMAL_VENTS` | Hydrothermal vents |
| `SEAMOUNTS` | Seamounts |
| `WORLD_PORTS` | World Ports |
| `PRISTINE_SEAS` | Pristine Seas |

`WORLD_PORTS` is also what the distance-to-port commands match on `copiedFromDataLibraryTemplateId`.

The Coral Reef Watch daily job looks up child templates on the superuser project, not the card id alone: `CRW_STATIONS`, `CRW_OVERLAYS`, `CRW_BAA`, `CRW_DHW`, `CRW_HOTSPOTS`, `CRW_SST`, `CRW_SSTA`, `CRW_SSTT`. See `packages/api/tasks/updateCRWTemplate.ts`.

Create-project and the geography wizard copy these templates. They are not Data Library cards:

| Template id | Use |
| --- | --- |
| `DAYLIGHT_COASTLINE` | Coastline |
| `MARINE_REGIONS_EEZ_LAND_JOINED` | Exclusive economic zone |
| `MARINE_REGIONS_TERRITORIAL_SEA` | Territorial sea |
| `MARINE_REGIONS_HIGH_SEAS` | High seas |

iNaturalist is not a template. The Data Library modal creates a project layer for it.

## A new template

1. Put the layer in the `superuser` project.
2. Stamp it with `assign_data_library_template_id`.
3. Pass that same string from a Data Library card, or from the job or wizard that should copy it.

The golden snapshot seeds only the ids in `snapshotTemplateIds.js`. Production has the rest. Do not add the rest of the production catalog to the snapshot. When a seeded template's id, URL, or outputs change, follow `.agents/skills/golden-snapshot/SKILL.md`. The seed calls `assign_data_library_template_id` itself (`packages/api/snapshots/data-library.sql`). A production layer that already exists is stamped with the function above. The seed does not create it.
