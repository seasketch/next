# Data tables glossary

This is the vocabulary for Data Tables. Labels, helper text, tooltips, database column comments, and code comments use these words. Code identifiers stay as they are; each term maps to the field named here.

- **Data table**. A CSV attached to a layer, stored as parquet.
- **Feature**. One shape in the map layer that a table row joins to. "Site" is acceptable only where it is the literal column name an admin chose.
- **Join column**. The table column whose values match feature IDs. `joinColumn`, `overlayJoinColumn`.
- **Survey time**. When a row's observation happened, as `_when_start` / `_when_end`, derived from the table's **time settings**. `temporal`.
- **Time step**. One bin on the timeslider at its current resolution. Replicates are grouped into time steps for the across-replicate calculation; they are never merged by one.
- **Value column**. A numeric column the map can show. `visualizationColumns`.
- **Calculation**. How value-column numbers are combined for one feature. Across rows: mean, sum, min, max, count, median (`visualizationOps`). Across replicates: mean, sum, min, max (`acrossReplicateOperations`).
- **Filter**. A user-facing condition on a column.
- **Replicate**. One survey of one feature: the rows that share the same survey time, the same feature, and the same value of every replicate column. `calculationMode = "replicates"`. The survey time is the row's own time, not the timeslider bin.
- **Replicate columns**. The columns that, with the survey time and the join column, identify one replicate. `additionalReplicateIdentifiers`.
- **Within a replicate** / **Across replicates**. The two calculation stages. `withinReplicateOperations`, `acrossReplicateOperations`.
- **Subject**. What the table is observations of. One **subject column** names it. `subjectColumn`. Organism enrichment (`organism.column`) is optional and must equal the subject column.
- **Detail columns**. Columns that describe one observation of a subject rather than the replicate. `observationDetailColumns`. Filtering on a detail column never removes a replicate that has any rows.
- **Nothing seen rows**. A value in a subject or detail column that means "surveyed, nothing seen". `effortMarkerValues`. The row registers its replicate and never contributes.
- **Rows to ignore**. A value whose rows are left out of everything. `excludedValues`, an object of column name to string array.
- **Survey columns**. Every other filterable column. Filtering on one selects which replicates exist. Not stored; it is the complement of subject, detail, value, join, and time columns.
- **Survey coverage**. When, and for which subjects, a replicate was actually looked at. The setting is "When a subject is missing from a replicate".
  - **It was surveyed and none were seen** (`coverageMode = "all_surveyed"`). A missing row is zero.
  - **Nothing can be assumed** (`coverageMode = "rows_only"`). A missing row is no data. A replicate that has rows, for any subject, still counts as surveyed.
  - **It depends on when and where** (`coverageMode = "coverage_file"`, `coverageRemote`). A coverage file lists periods. Inside a period a missing row is zero; outside it the replicate is not surveyed.
- **Zero**, **No data**, **Not surveyed**. A replicate surveyed for a subject that saw none is **zero** when the within-replicate calculation is sum, max, or min. A mean of nothing is **left out** ("no values"). A feature with no replicates left after survey filters is **no data**. A replicate not surveyed for the subject is **not surveyed** and is left out.
