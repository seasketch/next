# Admin journeys

> Part of the [2026 campaign record](README.md). Status: draft for iteration, November 2026.

[Catalog index](journeys.md) · [End-user journeys](journeys-end-user.md) · [Integration testing](integration-testing.md)

Project admins and superusers, inside the admin interface (`/:slug/admin` and the screens it links to). This suite matters, and it is a more forgiving bar than the [end-user catalog](journeys-end-user.md): a missing settings form does not hold up sketching, surveys, or the map. Bundler-risk rows in this file are the exception. Phase 4 still needs those green, because a bundler swap breaks the editors here.

Every item is tagged `@admin` plus one theme tag. None of these are `@smoke`. A journey may open the project map only to confirm what was just saved.

---

## Project settings

Intent: the Settings page. The participant-visible result of a flag (a missing toolbar entry) is an end-user journey, arranged without this form. Tag: `@settings`.

1. Name, logo, description, and URL slug can be changed. The new name appears in the project chrome.
2. Access control can be switched among public, invite-only, and admins-only. Saving succeeds. The visitor-facing gates are end-user tests.
3. Listed / unlisted changes whether the project is offered on `/projects`. Unlisting a public project is refused.
4. Map extent drawn in settings is stored as the default bounds.
5. Default scale bar and legend toggles save and match what a new visitor's map chrome is set to.
6. Supported languages can be added. The language list on this page matches.
7. Custom doc link changes the stored Help target.
8. Feature flags for data tables and iNaturalist layers show or hide the admin UI that uses them.
9. Hiding About, sketching, forums, or overlays saves. The participant toolbar check is end-user.

---

## Users, groups, and invites

Intent: the Users & Groups admin. The invitee's accept/join path is end-user. Tag: `@users`.

1. Participants list shows joined users. Admins list shows project admins.
2. Access requests can be approved or denied from the admin list.
3. Draft, sent, and bounced invite tabs show an invite created for this journey.
4. An admin creates a group, adds a participant, and the membership is saved.
5. CSV export of participants downloads a file.
6. Invite Users writes an invite email to `e2e-emails/`.
7. An admin can promote a participant to admin, demote them, and remove them. The lists update.
8. An unsent invite can be edited or deleted. A sent invite can be resent.

---

## Usage and activity

Intent: the usage dashboard renders. Exact counts may be empty on a fresh project. Tag: `@activity`.

1. `/:slug/admin/activity` shows the usage dashboard (visitors, sketches, surveys, storage) for a project admin.
2. Switching the period (7 days, 30 days, all) reloads the charts without an error.
3. Most-used layers lists overlay titles after a layer has been requested, or the empty state is explicit.

---

## Sketch classes

Intent: admins define what participants may digitize, which geography clips it, which attributes are collected, and which report it runs. The participant editor is end-user. Tag: `@sketching`.

1. Sketch Classes lists Marine Protected Area on `demo-samoa`. *Covered: `tests/admin.spec.ts`.*
2. An admin creates a sketch class from a template, names it, and the class appears in the admin list.
3. Settings: name, who may digitize (everyone, group, admins), archive (archived classes leave the create menu), and geography clipping against a named geography.
4. Attributes: add a text field and mark it required. An export id on that field is saved as the column name.
5. Style: a fill or line color chosen here is saved on the class.
6. Reports: assign a published report to the class.
7. The Filter tab's attribute controls are saved and available to the class.
8. An admin can open Preview New Reports on a sketch class that is not using geography clipping.
9. Superuser can publish a sketch class as a template and see it in the template chooser.

---

## Geography

Intent: clipping boundaries used by sketch preprocessing and by report widgets. Tag: `@geography`.

1. Geography lists Exclusive Economic Zone, Territorial Seas, and Offshore on `demo-samoa`. *Covered: `tests/admin.spec.ts`.*
2. The geography wizard creates an EEZ-based geography from a data-library template (filter to a Marine Regions id), optionally subtracts land, and the new geography appears in the list.
3. An admin can draw or edit a custom clipping layer and save it.
4. Sketch fragment status shows preprocessing progress after a clipping layer changes.
5. A report that requires a geography prompts the admin to create one before inserting size or overlay cards.

---

## Forums

Intent: creating and maintaining forums. Reading and posting are end-user. Tag: `@forums`.

1. An admin creates a forum, sets it readable by a group, and the forum is saved with that audience.
2. An admin can rename a forum, change who may post, and archive or delete it. The admin list updates.

---

## Basemaps

Intent: adding and editing a project's basemaps. Choosing one on the map is end-user. Tag: `@basemaps`.

1. An admin adds a project basemap from a Mapbox style URL, sets a thumbnail, and the basemap appears in the admin list.
2. An admin edits a basemap's labels or terrain on `/:slug/edit-basemap/:id` and the saved style is what the map uses when that basemap is selected.

---

## About page

Intent: the ProseMirror editor for the project about page. A visitor reading it is end-user. Tag: `@about`.

1. **bundler-risk.** An admin enables the about page, edits its body in the rich-text editor, saves, and the published body is the text they entered.

---

## Survey authoring

Intent: admins build, publish, invite, and export surveys. Taking a survey is end-user. Tag: `@surveys`.

1. An admin creates a survey from the surveys admin list and opens the form editor.
2. Adding Welcome, a Name field, a spatial question, and a Thank You, then publishing, makes the survey URL available.
3. Logic rules hide or show a question based on a previous answer. The rule is saved on the form.
4. QR and the public link match the published survey URL.
5. The response grid lists submitted responses. Export downloads CSV (or the documented format).
6. Draft control unpublishes the survey.
7. Sending a survey invite writes an email to `e2e-emails/`.
8. Enabling an alternate language and entering a translated question stores that translation.
9. Spatial-question settings (sectors, starting bounds, allowed drawing tools) save and match the editor's configuration.

---

## Data layers

Intent: the draft table of contents, cartography, metadata, and publish. Uploads and data tables have their own sections. What a visitor sees in Overlay Layers is end-user. Tag: `@layers`.

1. Data Layers lists the published Geography layers folder and its three layers on `demo-samoa`. *Covered: `tests/admin.spec.ts`.*
2. An admin creates a folder, nests a layer in it, and the draft tree shows that structure.
3. **bundler-risk.** Opening a hosted layer's GL style editor, changing a paint property with autocomplete, and saving. The map uses the new style after publish.
4. **bundler-risk.** Editing layer metadata in the rich-text editor and saving. View metadata shows the new citation.
5. The GUI style editor (simple polygon, point, or raster visualization, zoom range) saves a style that is the published style.
6. Interactivity / popup template: setting a field list saves those fields as the popup.
7. Labels from a column can be turned on and are part of the saved style.
8. Sharing / ACL: a layer limited to a group is saved with that audience.
9. Replace PMTiles on an existing source. The data source points at the new archive.
10. A remote GeoJSON or MVT URL can be added as a source.
11. The ArcGIS browser can add a service layer, or the journey records that the service is stubbed.
12. iNaturalist layers appear in admin only when that feature flag is on.
13. Hosting quota is shown. Exceeding it blocks a new upload with a clear error.
14. An unpublished rename is visible in the admin draft and not in the published tree until publish.
15. Hide from overlay list, z-order, and translated layer titles are saved. The published tree shows the chosen language, in the published order, without hidden items.
16. Switching the admin tree between draft and published shows each side's titles.
17. Changelog lists the newest 100 changes, omits net-zero reverted edits, and Load older changes appends the rest. *Covered: `tests/changelog.spec.ts`.*
18. Selective publish: rename two published layers, publish only one. The published tree shows that new title beside the other layer's published title. *Covered: `tests/selective-publish.spec.ts`.*
19. A new layer inside a new folder starts checked with that folder. Publishing ships both. *Covered.*
20. Publishing overlay versions: a new EBSA version reaches draft reports and end users only after publish. Publishing while preprocessing is still running keeps end-user reports working. *Covered: `tests/report-overlay-versions.spec.ts`.*
21. Data administration requires a tablet-sized screen. A phone-width viewport shows the phone-access message.

---

## Data uploads

Intent: pick a file on the Data Layers page, inspect it in the browser, presign, process locally, and see the layer in the tree. **bundler-risk** as a set. Tag: `@uploads`.

1. **bundler-risk.** A small GeoJSON is served from the uploads host and drawn on the map. Every stored URL is local. *Covered: `tests/uploads.spec.ts`.*
2. A GeoJSON large enough to tile is served as PMTiles from the tiles host with TileJSON pointing at itself. *Covered.*
3. A real GIS export below the tiling threshold keeps names and columns intact. *Covered.*
4. A real GIS export above the tiling threshold is tiled and a vector tile over the region has content. *Covered.*
5. AI Cartographer enabled: title and style come from the mocked AI service. Declined: the mock is never asked. *Covered.*
6. Shapefile (zip) and GeoTIFF follow the same local-URL assertions as GeoJSON.
7. A delimited file with latitude and longitude columns is configured in the delimited-upload modal and becomes a point layer.
8. Canceling an in-progress upload leaves no orphan layer in the tree.
9. Deleting a hosted layer removes it from the draft table of contents. Cleanup does not touch production remotes.

---

## Data tables

Intent: CSV (and similar) joined to a spatial layer, processed by the local data-tables handler, then edited. A participant querying rows is end-user. Tag: `@tables`.

1. **bundler-risk.** With the data-tables flag on, joining a CSV to Exclusive Economic Zone on `UNION` stores `parquet_remote` on `ssn-tiles-local`. *Covered: `tests/local-reports.spec.ts`.*
2. **bundler-risk.** After that import, the column editor lists the CSV columns and a type or alias can be saved.
3. Empty numeric columns do not crash the column menu.

---

## Report authoring

Intent: admins assemble cards and widgets. Slash-command insertion and ProseMirror node views are bundler-risk. What a participant sees on a seeded report is end-user. Tag: `@reports`.

1. Reports lists Default report on `demo-samoa`. *Covered: `tests/admin.spec.ts`.*
2. An admin creates a report, adds a tab, and assigns it to a sketch class.
3. **bundler-risk.** Inserting a text block and an overlay-overlap card through the editor (not SQL) and publishing stores both on the report.
4. Duplicate report copies cards. Group by report title keeps copies organized.
5. Copy cards from another report pastes into the current tab.
6. Publishing a draft makes it the published report. A newer draft does not replace it until published.
7. Inserting distance to port offers to copy the World Ports data-library template, then inserts the widget.

---

## Superuser and data library

Intent: platform operators, not project admins. Superuser is a claim on the test token. Tag: `@superuser`.

1. `/dashboard` is visible to a superuser and forbidden to a project admin who is not a superuser.
2. Featured flag and hosting quota on a project can be set from SuperUser settings on `/:slug/admin`.
3. Enable Offline Support on SuperUser settings reveals `/:slug/admin/offline` for that project.
4. The Data Library modal copies a template layer (Seamounts) into the draft table of contents with cartography intact.
5. Publish as template (sketch class or static cache) is available only to a superuser.

---

## Offline tile packages

Intent: generating the packages a cached client uses. **Do not farm these until the downstream plan in the [catalog index](journeys.md) exists.** The participant cache and offline survey are end-user. Tag: `@offline`.

1. With offline enabled, `/:slug/admin/offline` can generate a tile package for a survey map.
2. Basemap tiling settings (`.../offline/basemap/:id`) produce a package a cached client can use.
