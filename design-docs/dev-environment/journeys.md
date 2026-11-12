# Journey catalog

> Part of the [2026 campaign record](README.md). Status: draft for iteration, November 2026.

[Index](README.md) · [Strategy](strategy.md) · [Integration testing](integration-testing.md)

This is the product list phase 3 implements as Playwright journeys. Iterate here before farming tests to agents. Each numbered item is one test, or a tightly related pair that would be misleading to split. One or two sentences describe what a person does and what they should see.

It is not Cucumber. It is not an implementation sketch. Selectors, GraphQL arrange steps, and teardown live in `packages/e2e` when a journey is written. Areas that need a separate implementation plan before farming are marked as such.

Existing Playwright coverage is noted in italics so this list can be edited without duplicating work. An unmarked item is not yet a journey.

## How to use this catalog

**Tags.** Every journey carries one theme tag and may carry `@bundler`. `@smoke` is a speed class, not a theme: only the items under [Smoke](#smoke) get it. Theme tags let a person or an agent run one area: `@access`, `@homepage`, `@sketching`, `@surveys`, `@forums`, `@overlays`, `@uploads`, `@reports`, `@admin` (settings, users, activity), `@geography`, `@superuser`, `@offline`. `@auth0` is the signup journey that needs tenant secrets and is excluded from the Auth0-free jobs. Add a tag when a new heading needs one.

**Smoke versus full.** The push job runs `@smoke` only. The full suite runs everything and may take 20–30 minutes or longer. Locally: `npm run e2e:smoke` and `npm run e2e`. CI wiring is in [integration testing](integration-testing.md).

**Permission matrix.** Who may edit a setting stays in API tests. Browser journeys cover what each kind of person can **see and walk**: anonymous visitor, signed-in non-participant, participant, admin, superuser.

**Isolation.** Fixture projects (`demo-samoa`, `demo-maldives`, `demo-palawan`, `e2e-private`) are for reads and for smoke. A journey that mutates creates its own project (or a disposable user) and hard-deletes it. Tests never write to `superuser` or `demo-*` except where a read-only fixture is named.

**Downstream plans.** Offline support is a real product surface and belongs in this catalog, but its harness (service worker, tile packages, queued responses) is not obvious. Do not farm those items until a short plan under `.cursor/plans/` says how a Playwright run goes offline, what is cached, and what is stubbed. Other starred items can wait on a similar plan if a spike finds they need one.

**Bundler-risk.** Items marked **bundler-risk** are the acceptance test for phase 4. They must pass on Create React App before the bundler changes, and they must pass on the new build. They also carry their theme tag.

**Out of scope for this catalog.** Marketing case-study and use-case pages, legal pages, the developer-API marketing page, and viewport-by-viewport homepage chrome. A single public-site smoke is enough. Numeric overlay accuracy stays in overlay-engine unit tests. The production probe is not a local journey.

---

## Smoke

Intent: prove the app boots, the map loads, and the two seeded personas can enter a project. These three must stay fast. They are the only `@smoke` journeys. Do not grow this set as coverage expands; put new work in the theme sections.

1. An anonymous visitor opens `demo-samoa` and sees the map: the basemap response is a Mapbox GL style and the map has fired its load event. *Covered: `tests/smoke.spec.ts`.*
2. `e2e|member` opens `e2e-private`, sees the group-limited Members Forum, and does not see the admins-only forum. *Covered: `tests/smoke.spec.ts`.*
3. `e2e|admin` opens `demo-samoa` and follows Project Admin Dashboard to the admin page. *Covered: `tests/smoke.spec.ts`.*

---

## Public site and accounts

Intent: a person can find a project, create one, and manage the account that owns it. Auth0 signup is the one remaining onboarding hole; other access gates already mint `e2e|` users.

### Homepage and listing

1. An anonymous visitor opens `/`, sees the SeaSketch name, a Sign In control, and a link to Projects. *Covered: `tests/homepage.spec.ts`.*
2. Following Projects opens `/projects`, which lists Demo Samoa. Opening it lands on the project with the map loaded and Sign In still available. *Covered: `tests/homepage.spec.ts`.*
3. A signed-in user whose email is not verified cannot create a project: the form reports that email must be verified.
4. A signed-in verified user creates a project from `/new-project` (name, slug, geography from a template) and lands on that project's admin page.
5. Creating a project with a slug that already exists stays on the form and says the URL is already in use.
6. A signed-in admin sees their unlisted admins-only and invite-only projects on `/projects` after signing in; an anonymous visitor does not.

### Account

1. `/signin` sends an anonymous visitor into the Auth0 flow (the journey follows as far as the tenant page, then stops; it does not complete a password login).
2. A new visitor **signs up through Auth0** on the non-production tenant, returns to SeaSketch, and can open `/projects`. This is the remaining Cypress onboarding scenario. It is the one local journey that is allowed to call Auth0. It does not run in the Auth0-free CI jobs; it runs in a separately tagged job or locally with tenant secrets.
3. `/account-settings` asks an anonymous visitor to sign in, and shows cache settings to a signed-in user.
4. A signed-in user can set email notification preferences (forum replies, project invites) and see them persist after reload.

---

## Project access and onboarding

Intent: the three access-control modes, join, invites, and access requests. Browser tests cover the gates. *Mostly covered: `tests/access.spec.ts`.*

### Public, listed, and unlisted

1. An anonymous visitor opens a listed public project from `/projects` and sees the map. *Covered.*
2. An unlisted invite-only project is absent from `/projects`. *Covered.*

### Admins-only

1. An anonymous visitor at an admins-only project is told only administrators may enter, and is offered Sign In without Create an account. *Covered.*
2. A signed-in non-admin sees Admins Only and cannot open the map. *Covered.*
3. The project admin sees the map. *Covered.*

### Invite-only and access requests

1. An anonymous visitor at an unlisted invite-only URL is told an invitation is required and can sign in or create an account. *Covered.*
2. A signed-in non-participant can share a profile and request access; the request stays pending until an admin approves it; a reload then shows the map. *Covered.*

### Invites

1. `e2e|member` follows an invite email in `e2e-emails/`, lands on Join Project, skips the profile, opens the map, and the invite status is CONFIRMED. *Covered.*
2. Opened while signed out, that link stays on the invite page, offers Sign In and Create an Account, and leaves the invite unconfirmed. *Covered.*
3. An invite with admin privileges lets `e2e|member` past an admins-only gate; joining and sharing a profile opens the admin page. *Covered.*
4. Opened signed out, an admin invite to an email with no account offers Create an Account first; the suite then inserts that `e2e|` user the way a first login does and the confirm URL opens the admin page after join. *Covered.*
5. A signed-in account whose email is not the invite's is told the invitation was sent to the other address, and can accept as themselves. The logout-and-sign-in button is shown and not followed. *Covered.*
6. An invite whose token is already expired shows the expired message and stays unconfirmed. *Covered.*

### Join and profile

1. A signed-in non-participant can skip join (localStorage) and still see the public map, with sketching and posting gated.
2. Join with an empty Full Name stays on the page, marks Full Name as Required, and does not join. *Covered as part of `tests/forums.spec.ts`.*
3. After joining, `/:slug/profile` opens the profile modal and a name change is saved.

---

## Project map shell

Intent: the toolbar, legend, and map chrome that every participant uses. Overlay search and downloads sit with overlay layers.

1. With access, the toolbar offers About (when enabled), Maps, Overlay Layers, Sketching, and Forums (when those are not hidden).
2. An admin sees Project Admin Dashboard; a participant does not.
3. Map settings can show the scale bar and switch coordinate display; the map stays loaded.
4. The measure tool draws a path and reports a distance.
5. `/:slug/app/accessibility` opens the accessibility statement.
6. Hiding sketches, forums, or overlays in project settings removes those toolbar entries for a participant on reload.
7. A map bookmark created from the map chrome (not a forum post) can be restored: the map returns to that center, zoom, and basemap.

---

## Overlay layers

Intent: the published table of contents on the map. Admin editing of the draft TOC is under [Data layers](#data-layers-administration).

1. An anonymous user opens Overlay Layers and sees the public Geography layers folder; expanding it lists Exclusive Economic Zone, Land, and Territorial Seas. *Covered: `tests/overlays.spec.ts`.*
2. Checking Exclusive Economic Zone turns that layer on; the legend lists it; unchecking removes it from the legend. *Covered.*
3. Right-clicking Exclusive Economic Zone → View metadata opens a modal whose body includes the Marine Regions citation. *Covered.*
4. Typing "Territorial" into layer search leaves Territorial Seas visible and hides Land. *Covered.*
5. Opacity on a visible layer changes the legend control and the map paint.
6. **bundler-risk.** Zoom to a layer whose bounds match the project region flies the map to those bounds.
7. When download is enabled on a layer, Data download offers the hosted file and the browser receives bytes from the local uploads or tiles host, not from production.
8. A click on a vector layer with a popup template shows attributes; a transparent raster pixel does not.
9. Optional layers stay off until checked; a folder of optional layers can be toggled together.
10. A temporal overlay exposes the time slider; changing the year requests a different raster or vector source.

---

## Basemaps

1. An anonymous user opens Maps and sees Light and Satellite; Light is active. *Covered: `tests/basemaps.spec.ts`.*
2. Choosing Satellite switches the basemap; the map stays loaded and the stylesheet includes Mapbox satellite raster tiles. *Covered.*
3. An admin adds a project basemap from a Mapbox style URL, sets a thumbnail, and a participant can select it.
4. An admin edits a basemap's labels or terrain on `/:slug/edit-basemap/:id` and those changes appear on the map.
5. When a Google basemap is configured, a participant can select it and the map loads Google tiles (using the local session the snapshot refresh queued).

---

## Language and about

Intent: translated project UI and the about page's ProseMirror editor.

1. An anonymous user opens the project menu, chooses Samoan, and the sidebar reads Fa'atalanoaga Lautele for Discussion Forums; English restores Discussion Forums. *Covered: `tests/language.spec.ts`.*
2. Translated project name and description appear in the listing and on the about page when that language is selected.
3. **bundler-risk.** An admin enables the about page, edits its body in the rich-text editor, saves, and a visitor sees that content at `/:slug/app/about`.

---

## Sketching tools

Intent: participants digitize and manage sketches that represent features such as Marine Protected Areas. Geometry is clipped to the planning geography. Reports on those sketches are under [Reports](#reports-on-sketches).

Users see a sketching tools area in the sidebar, listing their sketches and each sketch class they may digitize.

1. A signed-out visitor who opens Sketching is asked to sign in; there is no create menu.
2. A signed-in non-participant is asked to join before they can digitize.
3. A participant sees each available sketch class in a create dropdown, and an empty (or fixture) list of their sketches and folders.
4. A participant creates a new MPA (polygon) sketch, digitizes a polygon that is then clipped to the planning geography with land removed, fills Name in the attribute form, saves, and the sketch appears in their list. *A drawn polygon with clipping is exercised in `tests/local-reports.spec.ts`; the attribute form and sidebar listing are not the point of that journey.*
5. Saving without a required attribute stays on the editor and marks the field invalid.
6. Invalid geometry (self-intersection) is rejected or offered for delete, and a valid polygon can be drawn afterward.
7. Edit opens the same sketch, the vertex can be moved, and save updates the shape on the map.
8. Delete asks for confirmation and removes the sketch from the list and the map.
9. Copy duplicates a sketch into the same parent; the copy can be renamed.
10. Export as GeoJSON downloads a file for that sketch.
11. Zoom to flies the map to the sketch bounds.
12. Checking a sketch in the tree shows it on the map; unchecking hides it.
13. Sketches can be organized into folders, including a folder inside a folder; create-in-folder puts a new sketch in the selected folder.
14. Drag-and-drop (or move) from one folder to another updates the tree and keeps the sketch visible.
15. Rename folder changes the label in the tree.
16. A **collection** sketch class creates a parent with no drawn geometry; child polygons can be added inside it and the collection appears as a group in the tree.
17. A **point** sketch class places a point; a **linestring** sketch class draws a line; both save and list like polygons.
18. A **choose-feature** sketch class picks an existing planning-unit or overlay feature instead of freehand drawing.
19. A **filtered planning units** sketch class uses the filter UI and reports a count of selected units.
20. Filter attributes on a sketch class (admin Filter tab) appear as filter controls on the participant editor and change the selected-unit count.
21. Shared-in-forum sketches are read-only in the tree; Copy from shared puts a copy in the participant's own list.
22. View Reports on a saved MPA opens the report window with at least the size sentence. *Covered in spirit by `tests/local-reports.spec.ts`.*
23. An admin with preview-new-reports enabled can open Preview New Reports on a sketch class that is not using geography clipping.

---

## Sketch class administration

Intent: admins define what participants may digitize, which geography clips it, which attributes are collected, and which report it runs.

1. Sketch Classes lists Marine Protected Area on `demo-samoa`. *Covered: `tests/admin.spec.ts`.*
2. An admin creates a sketch class from a template, names it, and it appears in the participant create menu.
3. Settings: name, who may digitize (everyone, group, admins), archive (archived classes leave the create menu), and geography clipping against a named geography.
4. Attributes: add a text field, mark it required, and the participant editor shows it. An export id on that field becomes the column name in a sketch export.
5. Style: a fill or line color chosen in admin is the color of a newly saved sketch on the map.
6. Reports: assign a published report to the class; View Reports on a sketch uses that report.
7. Superuser can publish a sketch class as a template and see it in the template chooser.

---

## Geography

Intent: clipping boundaries used by sketch preprocessing and by several report widgets.

1. Geography lists Exclusive Economic Zone, Territorial Seas, and Offshore on `demo-samoa`. *Covered: `tests/admin.spec.ts`.*
2. The geography wizard creates an EEZ-based geography from a data-library template (filter to a Marine Regions id), optionally subtracts land, and the new geography appears in the list.
3. An admin can draw or edit a custom clipping layer and save it.
4. Sketch fragment status shows preprocessing progress after a clipping layer changes.
5. A report that requires a geography prompts the admin to create one before inserting size or overlay cards.

---

## Forums

Intent: discussion attached to a project, including map bookmarks (bundler-risk) and sketch sharing.

1. An anonymous visitor can open Public Forum, read Welcome to the project, sees a sign-in prompt, and has no reply form. *Covered: `tests/forums.spec.ts`.*
2. A signed-in non-participant is asked to join; after join they can reply. *Covered.*
3. **bundler-risk.** Typing a reply in the ProseMirror editor, submitting, and seeing that reply in the thread. *Covered.*
4. **bundler-risk.** Share → Map Bookmark captures a client thumbnail; posting shows it; the info button shows the large screenshot from the local screenshotter. *Covered: `tests/map-bookmarks.spec.ts`.*
5. Post a topic: a normal title posts; eighty emoji is allowed; eighty-one characters show the limit and disable Post New Topic; empty title and empty message each ask for content. *Covered: `tests/topic-title.spec.ts`.*
6. An admin creates a forum, sets it readable by a group, and a member of that group sees it while others do not. *Group visibility is part of smoke on `e2e-private`.*
7. Attach a file to a post; the attachment is downloadable.
8. Share sketches into a forum post; a reader can copy them into their own sketch list.
9. A topic title that is too long is explained before posting. *Covered: `tests/topic-title.spec.ts`.*
10. An admin can rename a forum, change who may post, and archive or delete it; a participant then sees the updated list.

---

## Surveys (respondent)

Intent: taking a published survey, including spatial questions. Authoring is the next section. Offline taking is under [Offline support](#offline-support).

1. An anonymous visitor completes the Maldives Ocean Use Survey: two sectors, Finish Sector between them, Next sector to move, then submit. *Covered: `tests/survey.spec.ts`.*
2. Palawan Coral Restoration Survey: the first visit starts drawing without a sector picker; coming back shows the sector list with the area count. *Covered.*
3. Practice mode (`/.../practice`) does not write a submitted response.
4. A survey that requires email or name will not advance until those are provided; skip is offered where the form allows it.
5. Consent records an accepted version; declining blocks submit.
6. Multiple choice (single and multi-select), short text, textarea, number, rating, yes/no, combo box, matrix, and demographic choice each store an answer and appear in the admin response grid.
7. Facilitated / group response collects facilitator name and participant count.
8. Invalid polygon on a spatial question can be deleted; a second shape can be added to the same sector.
9. Basemap selector, scale bar, and “focus on location” work on a spatial question.
10. A disabled (draft) survey is reachable by an admin and not by an anonymous visitor.

---

## Survey authoring

Intent: admins build, publish, and export surveys.

1. An admin creates a survey from the surveys admin list and opens the form editor.
2. Adding Welcome, a Name field, a spatial question, and a Thank You, then publishing, makes the survey URL takeable.
3. Logic rules hide or show a question based on a previous answer.
4. QR and the public link open the published survey.
5. Response grid lists submitted responses; export downloads CSV (or the documented format).
6. Draft control unpublishes; anonymous visitors then cannot start it.
7. A survey invite email in `e2e-emails/` opens the survey for that address; an uninvited visitor is refused when the survey is invite-only.
8. Enabling an alternate language and translating a question shows the translated label when the respondent picks that language.
9. Spatial-question settings (sectors, starting bounds, allowed drawing tools) match what the respondent editor offers.

---

## Data layers administration

Intent: the draft table of contents, cartography, metadata, and publish. Uploads and data tables have their own sections.

1. Data Layers lists the published Geography layers folder and its three layers on `demo-samoa`. *Covered: `tests/admin.spec.ts`.*
2. An admin creates a folder, nests a layer in it, and the draft tree shows that structure.
3. **bundler-risk.** Opening a hosted layer's GL style editor, changing a paint property with autocomplete, and saving; the map uses the new style after publish.
4. **bundler-risk.** Editing layer metadata in the rich-text editor and saving; View metadata on the map shows the new citation.
5. The GUI style editor (simple polygon / point / raster visualization, zoom range) saves a style a participant sees after publish.
6. Interactivity / popup template: setting a field list and confirming a click on the map shows those fields.
7. Labels from a column can be turned on and appear on the map.
8. Sharing / ACL: a layer limited to a group is hidden from a participant who is not in that group and visible to one who is.
9. Replace PMTiles on an existing source; the map fetches the new archive.
10. Remote GeoJSON or MVT URL can be added as a source and drawn.
11. ArcGIS browser can add a service layer (or the journey records that the service is stubbed).
12. iNaturalist layers appear in admin only when that feature flag is on.
13. Hosting quota is shown; exceeding it blocks a new upload with a clear error.
14. Draft versus published: an unpublished rename is visible in admin Overlay Layers and not to an anonymous visitor until publish.
15. Hide from overlay list, z-order, and translated layer titles: a participant sees the published titles in the chosen language, in the published order, without hidden items.
16. Switching the admin tree between draft and published shows each side's titles.
17. Changelog lists the newest 100 changes, omits net-zero reverted edits, and Load older changes appends the rest. *Covered: `tests/changelog.spec.ts`.*
18. Selective publish: rename two published layers, publish only one; an anonymous visitor sees that new title beside the other layer's published title. *Covered: `tests/selective-publish.spec.ts`.*
19. A new layer inside a new folder starts checked with that folder; publishing ships both. *Covered.*
20. Publishing overlay versions: a new EBSA version reaches draft reports and end users only after publish; publishing while preprocessing is still running keeps end-user reports working. *Covered: `tests/report-overlay-versions.spec.ts`.*
21. Data administration requires a tablet-sized screen; a phone-width viewport shows the phone-access message.

---

## Data uploads

Intent: pick a file, inspect it in the browser, presign, process locally, and see it on the map. **bundler-risk** as a set.

1. **bundler-risk.** A small GeoJSON is served from the uploads host and drawn on the map; every stored URL is local. *Covered: `tests/uploads.spec.ts`.*
2. A GeoJSON large enough to tile is served as PMTiles from the tiles host with TileJSON pointing at itself. *Covered.*
3. A real GIS export below the tiling threshold keeps names and columns intact. *Covered.*
4. A real GIS export above the tiling threshold is tiled and a vector tile over the region has content. *Covered.*
5. AI Cartographer enabled: title and style come from the mocked AI service; declined: the mock is never asked. *Covered.*
6. Shapefile (zip) and GeoTIFF follow the same local-URL and map-draw assertions as GeoJSON.
7. A delimited file with latitude/longitude columns is configured in the delimited-upload modal and becomes a point layer.
8. Canceling an in-progress upload leaves no orphan layer in the tree.
9. Deleting a hosted layer removes it from the draft TOC and, after publish, from the public map; cleanup does not touch production remotes.

---

## Data tables

Intent: CSV (and similar) joined to a spatial layer, processed by the local data-tables handler.

1. **bundler-risk.** With the data-tables flag on, joining a CSV to Exclusive Economic Zone on `UNION` stores `parquet_remote` on `ssn-tiles-local`. *Covered: `tests/local-reports.spec.ts`.*
2. **bundler-risk.** After that import, the column editor lists the CSV columns and a type or alias can be saved.
3. A data-table query from the map or legend returns rows from the local tiles host.
4. Empty numeric columns do not crash the column menu.

---

## Reports on sketches

Intent: what a participant sees after digitizing. Cards may be seeded with SQL when the journey is about the public view, not the authoring UI.

1. **bundler-risk.** A drawn sketch shows size and overlay-overlap sentences computed by local workers, including a mix of a production EEZ and locally uploaded layers. *Covered: `tests/local-reports.spec.ts`.*
2. Opening a second sketch's report replaces the first; closing the report removes report layers from the main map.
3. Print report (or Print on a card) expands collapsed collection rows and details blocks.
4. CSV/JSON export from a table widget downloads a file whose columns match the on-screen table.
5. Show on main map from a distance widget puts the route on the project map; Remove from main map clears it.
6. Collection reports group child sketches; expanding a row shows per-child metrics.

---

## Report authoring

Intent: admins assemble cards and widgets. Slash-command insertion and ProseMirror node views are bundler-risk even when the public view is already covered.

1. Reports lists Default report on `demo-samoa`. *Covered: `tests/admin.spec.ts`.*
2. An admin creates a report, adds a tab, and assigns it to a sketch class.
3. **bundler-risk.** Inserting a text block and an overlay-overlap card through the editor (not SQL), publishing, and seeing both on a sketch report.
4. Duplicate report copies cards; Group by report title keeps copies organized.
5. Copy cards from another report pastes into the current tab.
6. Publishing a draft makes it the one participants see; a newer draft does not until published.
7. Geography size, feature count, presence, feature list, column statistics, raster band statistics, class composition, histograms, time series, intersecting features, sketch attributes table, and MPA guide cards each render with fixture layers (one journey per card type is enough; numeric accuracy stays in unit tests).
8. Distance to shore and distance to port (including the World Ports data-library prompt) render a map and a number on a clipped sketch.
9. Fuel-assumptions tab on a distance-to-point map shows a one-way cost from editable defaults.

---

## Users, groups, and invites (admin)

1. Participants list shows joined users; admins list shows project admins.
2. Access requests can be approved or denied from the admin list.
3. Draft / sent / bounced invite tabs show the invite created by an access journey.
4. An admin creates a group, adds a participant, and a layer or forum limited to that group follows.
5. CSV export of participants downloads a file.
6. Invite Users from the admin UI writes an invite email to `e2e-emails/`; following it joins as in [Invites](#invites).
7. An admin can promote a participant to admin, demote them, and remove them; the participant's next visit matches the new role.
8. An unsent invite can be edited or deleted; a sent invite can be resent.

---

## Project settings

1. Name, logo, description, and URL slug can be changed; the new name appears in the toolbar.
2. Access control can be switched among public, invite-only, and admins-only; the gates in [Project access](#project-access-and-onboarding) still hold.
3. Listed / unlisted changes whether the project appears on `/projects`. Unlisting a public project is refused.
4. Map extent drawn in settings is the default bounds for a new visitor.
5. Default scale bar and legend toggles match a new visitor's map chrome.
6. Supported languages can be added; the language menu matches.
7. Custom doc link changes the Help button target.
8. Feature flags: data tables and iNaturalist layers gate the admin UI that uses them.
9. Hide About (when the about page exists) removes About from the toolbar.

---

## Usage and activity

Intent: admins see whether the project is being used. Exact counts may be empty on a fresh snapshot; the journey asserts the dashboard renders and period switching works.

1. `/:slug/admin/activity` shows the usage dashboard (visitors, sketches, surveys, storage) for a project admin.
2. Switching the period (7d / 30d / all) reloads the charts without an error.
3. Most-used layers lists overlay titles after a journey has turned a layer on (or the empty state is explicit).

---

## Superuser and data library

Intent: platform operators, not project admins. Superuser is a claim on the test token.

1. `/dashboard` is visible to a superuser and forbidden to a project admin who is not superuser.
2. Featured flag and hosting quota on a project can be set from SuperUser settings on `/:slug/admin`.
3. Enable Offline Support on SuperUser settings reveals `/:slug/admin/offline` for that project.
4. Data Library modal copies a template layer (Seamounts) into the draft TOC with cartography intact.
5. A report widget that needs World Ports offers to copy that template, then inserts the widget.
6. Publish as template (sketch class or static cache) is available only to superuser.

---

## Offline support

Intent: cached maps and surveys that work with the network down. **Do not farm these journeys until a downstream implementation plan exists.** That plan should say how Playwright takes the browser offline, which service-worker routes are under test, how tile packages are built in the e2e profile, and what is stubbed. **bundler-risk** if offline surveys remain a supported feature; if they do not, record the drop here and delete the Workbox plugin with Create React App.

### Plan first

1. Write `.cursor/plans/` (or a section of this file once decided) covering: service worker registration in the e2e client, GraphQL query cache, basemap tile cache, survey response queue, admin tile-package generation, and `/submit-offline-surveys`.
2. Decide whether offline surveys stay. If no, the rest of this section is deleted and the bundler-risk row in [integration testing](integration-testing.md) is replaced with that decision.

### User cache

1. A signed-in user opens project cache settings (`/:slug/app/settings`) and sees data-caching level and basemap download when `isOfflineEnabled`.
2. After caching, going offline still opens the project map from the service worker (basemap and cached overlay).
3. `/account-settings` shows the same cache controls globally.
4. Offline homepage overlay lists cached projects and surveys.

### Offline surveys

1. A published survey can be cached; taken offline; answers queue locally.
2. `/submit-offline-surveys` submits the queue when back online; the admin response grid then contains the response.

### Admin tile packages

1. With offline enabled, `/:slug/admin/offline` can generate a tile package for a survey map.
2. Basemap tiling settings (`.../offline/basemap/:id`) produce a package a cached client can use.

---

## Bundler-risk index

These must pass on Create React App before phase 4, and on the new build after. Duplicated from the sections above so the set is reviewable in one place.

1. Spatial upload end to end (worker, WASM, presigned PUT, layer renders). *Mostly covered: `tests/uploads.spec.ts`.*
2. Data-table import with columns visible in the editor. *Partial: parquet on local storage only.*
3. Report card on a drawn sketch from local overlay workers. *Covered: `tests/local-reports.spec.ts`.*
4. ProseMirror: about page, forum post, layer metadata. *Forum post covered; about and metadata missing.*
5. GL style editor with autocomplete, save, and map update. *Missing.*
6. Map bookmark screenshot. *Covered: `tests/map-bookmarks.spec.ts`.*
7. Service worker / offline survey, or a recorded decision to drop it. *Missing; needs the offline plan.*
8. A client env-var assertion that a `REACT_APP_*` value reaches the bundle (so the phase 4 rename is tested, not grepped). *Missing.*
9. Report authoring insertion of a ProseMirror card (not SQL). *Missing.*
10. Zoom to layer bounds. *Missing.*

---

## Already implemented, not in the catalog above as new work

These exist and should keep their tags when the suite is split. They do not need to be re-farmed.

- Smoke (3), access (10), homepage listing, forums join/reply, topic title, overlays browse, basemaps switch, language switch, admin seed lists, changelog, uploads (6), local reports and data-table storage, map bookmarks, Maldives and Palawan surveys, selective publish, report overlay versions.
