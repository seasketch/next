# End-user journeys

> Part of the [2026 campaign record](README.md). Status: draft for iteration, November 2026.

[Catalog index](journeys.md) · [Admin journeys](journeys-admin.md) · [Integration testing](integration-testing.md)

Visitors, participants, and account holders. The map, sketches, surveys, forums, and reports they actually use. This is the critical suite. Every item is tagged `@enduser` plus one theme tag. None of these are `@smoke`.

Setup that an admin would click through (a hidden toolbar, a group-limited forum, a published layer) is arranged in the database or through GraphQL. The test walks the end-user interface. Admin screens are [journeys-admin.md](journeys-admin.md).

---

## Public site and accounts

Intent: a person can find a project, create one, and manage the account that owns it. Auth0 signup is the one remaining onboarding hole. Tag: `@homepage`. The signup item also carries `@auth0`.

### Homepage and listing

1. An anonymous visitor opens `/`, sees the SeaSketch name, a Sign In control, and a link to Projects. *Covered: `tests/homepage.spec.ts`.*
2. Following Projects opens `/projects`, which lists Demo Samoa. Opening it lands on the project with the map loaded and Sign In still available. *Covered: `tests/homepage.spec.ts`.*
3. A signed-in user whose email is not verified cannot create a project: the form reports that email must be verified.
4. A signed-in verified user creates a project from `/new-project` (name, slug, geography from a template) and lands in that project.
5. Creating a project with a slug that already exists stays on the form and says the URL is already in use.
6. A signed-in member sees projects they belong to that are unlisted; an anonymous visitor does not see those projects on `/projects`.

### Account

1. `/signin` sends an anonymous visitor into the Auth0 flow (the journey follows as far as the tenant page, then stops; it does not complete a password login).
2. A new visitor **signs up through Auth0** on the non-production tenant, returns to SeaSketch, and can open `/projects`. This is the remaining Cypress onboarding scenario. It is the one local journey allowed to call Auth0. It does not run in the Auth0-free CI jobs. Tag `@auth0` as well as `@enduser`.
3. `/account-settings` asks an anonymous visitor to sign in, and shows cache settings to a signed-in user.
4. A signed-in user can set email notification preferences (forum replies, project invites) and see them persist after reload.
5. **bundler-risk.** A value that reaches the client through `REACT_APP_*` today is visible in the running app, so the phase 4 rename is checked by a test and not by reading the bundle.

---

## Project access and onboarding

Intent: what each kind of person sees at the project door. Join, invites, and access requests. Who may edit a setting stays in API tests. Tag: `@access`. *Mostly covered: `tests/access.spec.ts`.*

### Public, listed, and unlisted

1. An anonymous visitor opens a listed public project from `/projects` and sees the map. *Covered.*
2. An unlisted invite-only project is absent from `/projects`. *Covered.*

### Admins-only

1. An anonymous visitor at an admins-only project is told only administrators may enter, and is offered Sign In without Create an account. *Covered.*
2. A signed-in non-admin sees Admins Only and cannot open the map. *Covered.*
3. The project admin sees the map. *Covered.*

### Invite-only and access requests

1. An anonymous visitor at an unlisted invite-only URL is told an invitation is required and can sign in or create an account. *Covered.*
2. A signed-in non-participant can share a profile and request access. The request stays pending until it is approved. A reload then shows the map. The approval itself may be a test helper; the admin list UI is in the [admin catalog](journeys-admin.md#users-groups-and-invites). *Covered.*

### Invites

1. `e2e|member` follows an invite email in `e2e-emails/`, lands on Join Project, skips the profile, opens the map, and the invite status is CONFIRMED. *Covered.*
2. Opened while signed out, that link stays on the invite page, offers Sign In and Create an Account, and leaves the invite unconfirmed. *Covered.*
3. An invite with admin privileges lets `e2e|member` past an admins-only gate. Joining and sharing a profile opens the project. *Covered.*
4. Opened signed out, an admin invite to an email with no account offers Create an Account first. The suite then inserts that `e2e|` user the way a first login does, and the confirm URL lets them join. *Covered.*
5. A signed-in account whose email is not the invite's is told the invitation was sent to the other address, and can accept as themselves. The logout-and-sign-in button is shown and not followed. *Covered.*
6. An invite whose token is already expired shows the expired message and stays unconfirmed. *Covered.*

### Join and profile

1. A signed-in non-participant can skip join (localStorage) and still see the public map, with sketching and posting gated.
2. Join with an empty Full Name stays on the page, marks Full Name as Required, and does not join. *Covered as part of `tests/forums.spec.ts`.*
3. After joining, `/:slug/profile` opens the profile modal and a name change is saved.

---

## Project map shell

Intent: the toolbar, legend, and map chrome a participant uses. Tag: `@map`.

1. With access, the toolbar offers About (when enabled), Maps, Overlay Layers, Sketching, and Forums (when those are not hidden).
2. A project admin sees Project Admin Dashboard in the chrome. A participant does not. This checks the map shell, not the admin pages.
3. Map settings can show the scale bar and switch coordinate display. The map stays loaded.
4. The measure tool draws a path and reports a distance.
5. `/:slug/app/accessibility` opens the accessibility statement.
6. When sketches, forums, or overlays have been hidden for the project, those toolbar entries are gone for a participant. The test arranges the flags; it does not open project settings.
7. A map bookmark created from the map chrome (not a forum post) can be restored: the map returns to that center, zoom, and basemap.

---

## Overlay layers

Intent: the published table of contents on the map. Draft editing, cartography, and publish are in the [admin catalog](journeys-admin.md#data-layers). Tag: `@overlays`.

1. An anonymous user opens Overlay Layers and sees the public Geography layers folder. Expanding it lists Exclusive Economic Zone, Land, and Territorial Seas. *Covered: `tests/overlays.spec.ts`.*
2. Checking Exclusive Economic Zone turns that layer on. The legend lists it. Unchecking removes it from the legend. *Covered.*
3. Right-clicking Exclusive Economic Zone → View metadata opens a modal whose body includes the Marine Regions citation. *Covered.*
4. Typing "Territorial" into layer search leaves Territorial Seas visible and hides Land. *Covered.*
5. Opacity on a visible layer changes the legend control and the map paint.
6. **bundler-risk.** Zoom to a layer whose bounds match the project region flies the map to those bounds.
7. When download is enabled on a layer, Data download offers the hosted file and the browser receives bytes from the local uploads or tiles host, not from production.
8. A click on a vector layer with a popup template shows attributes. A transparent raster pixel does not.
9. Optional layers stay off until checked. A folder of optional layers can be toggled together.
10. A temporal overlay exposes the time slider. Changing the year requests a different raster or vector source.
11. A data-table query from the map or legend returns rows from the local tiles host. The import and column editor are admin.

---

## Basemaps

Intent: choosing a basemap on the project map. Adding and editing basemaps is admin. Tag: `@basemaps`.

1. An anonymous user opens Maps and sees Light and Satellite. Light is active. *Covered: `tests/basemaps.spec.ts`.*
2. Choosing Satellite switches the basemap. The map stays loaded and the stylesheet includes Mapbox satellite raster tiles. *Covered.*
3. When a Google basemap is configured, a participant can select it and the map loads Google tiles (using the local session the snapshot refresh queued).

---

## Language and about

Intent: a visitor reads the project in another language and can open the about page. Editing the about body is admin. Tag: `@language`.

1. An anonymous user opens the project menu, chooses Samoan, and the sidebar reads Fa'atalanoaga Lautele for Discussion Forums. English restores Discussion Forums. *Covered: `tests/language.spec.ts`.*
2. Translated project name and description appear in the listing and on the about page when that language is selected.
3. A visitor opens `/:slug/app/about` and sees the published about body.

---

## Sketching tools

Intent: participants digitize and manage sketches that represent features such as Marine Protected Areas. Geometry is clipped to the planning geography. They see a sketching tools area in the sidebar, listing their sketches and each sketch class they may digitize. Defining a sketch class is admin. Reports they open from a sketch are the next section. Tag: `@sketching`.

1. A signed-out visitor who opens Sketching is asked to sign in. There is no create menu.
2. A signed-in non-participant is asked to join before they can digitize.
3. A participant sees each available sketch class in a create dropdown, and a list of their sketches and folders.
4. A participant creates a new MPA (polygon) sketch, digitizes a polygon that is then clipped to the planning geography with land removed, fills Name in the attribute form, saves, and the sketch appears in their list. *A drawn polygon with clipping is exercised in `tests/local-reports.spec.ts`. The attribute form and sidebar listing are not the point of that journey.*
5. Saving without a required attribute stays on the editor and marks the field invalid.
6. Invalid geometry (self-intersection) is rejected or offered for delete, and a valid polygon can be drawn afterward.
7. Edit opens the same sketch, the vertex can be moved, and save updates the shape on the map.
8. Delete asks for confirmation and removes the sketch from the list and the map.
9. Copy duplicates a sketch into the same parent. The copy can be renamed.
10. Export as GeoJSON downloads a file for that sketch.
11. Zoom to flies the map to the sketch bounds.
12. Checking a sketch in the tree shows it on the map. Unchecking hides it.
13. Sketches can be organized into folders, including a folder inside a folder. Create-in-folder puts a new sketch in the selected folder.
14. Drag-and-drop (or move) from one folder to another updates the tree and keeps the sketch visible.
15. Rename folder changes the label in the tree.
16. A **collection** sketch class creates a parent with no drawn geometry. Child polygons can be added inside it and the collection appears as a group in the tree.
17. A **point** sketch class places a point. A **linestring** sketch class draws a line. Both save and list like polygons.
18. A **choose-feature** sketch class picks an existing planning-unit or overlay feature instead of freehand drawing.
19. A **filtered planning units** sketch class uses the filter UI and reports a count of selected units.
20. Filter controls configured on the class appear on the participant editor and change the selected-unit count. The admin Filter tab is not this journey.
21. Shared-in-forum sketches are read-only in the tree. Copy from shared puts a copy in the participant's own list.
22. View Reports on a saved MPA opens the report window with at least the size sentence. *Covered in spirit by `tests/local-reports.spec.ts`.*

---

## Forums

Intent: reading and posting in a project forum, including map bookmarks. Creating a forum and setting who may see it is admin. Tag: `@forums`.

1. An anonymous visitor can open Public Forum, read Welcome to the project, sees a sign-in prompt, and has no reply form. *Covered: `tests/forums.spec.ts`.*
2. A signed-in non-participant is asked to join. After join they can reply. *Covered.*
3. **bundler-risk.** Typing a reply in the ProseMirror editor, submitting, and seeing that reply in the thread. *Covered.*
4. **bundler-risk.** Share → Map Bookmark captures a client thumbnail. Posting shows it. The info button shows the large screenshot from the local screenshotter. *Covered: `tests/map-bookmarks.spec.ts`.*
5. Post a topic: a normal title posts. Eighty emoji is allowed. Eighty-one characters show the limit and disable Post New Topic. Empty title and empty message each ask for content. *Covered: `tests/topic-title.spec.ts`.*
6. A participant who is in the group a forum is limited to can see that forum. A participant who is not in the group cannot. *Group visibility on `e2e-private` is also part of smoke. This journey is the end-user check beyond smoke, arranged without the admin form.*
7. Attach a file to a post. The attachment is downloadable.
8. Share sketches into a forum post. A reader can copy them into their own sketch list.

---

## Surveys

Intent: taking a published survey, including spatial questions. Building the form is admin. Offline taking is under [Offline](#offline). Tag: `@surveys`.

1. An anonymous visitor completes the Maldives Ocean Use Survey: two sectors, Finish Sector between them, Next sector to move, then submit. *Covered: `tests/survey.spec.ts`.*
2. Palawan Coral Restoration Survey: the first visit starts drawing without a sector picker. Coming back shows the sector list with the area count. *Covered.*
3. Practice mode (`/.../practice`) does not write a submitted response.
4. A survey that requires email or name will not advance until those are provided. Skip is offered where the form allows it.
5. Consent records an accepted version. Declining blocks submit.
6. Multiple choice (single and multi-select), short text, textarea, number, rating, yes/no, combo box, matrix, and demographic choice each store an answer on submit. Browsing the response grid is admin.
7. Facilitated / group response collects facilitator name and participant count.
8. Invalid polygon on a spatial question can be deleted. A second shape can be added to the same sector.
9. Basemap selector, scale bar, and focus on location work on a spatial question.
10. A disabled (draft) survey cannot be started by an anonymous visitor.
11. A respondent who follows a survey invite email in `e2e-emails/` can open that survey. An uninvited visitor is refused when the survey is invite-only.
12. When a question has a translation, choosing that language shows the translated label.

---

## Reports

Intent: what a participant sees after digitizing, or when they open a published report. Cards may be seeded with SQL. Inserting cards in the editor is admin. Numeric accuracy stays in unit tests. Tag: `@reports`.

1. **bundler-risk.** A drawn sketch shows size and overlay-overlap sentences computed by local workers, including a mix of a production EEZ and locally uploaded layers. *Covered: `tests/local-reports.spec.ts`.*
2. Opening a second sketch's report replaces the first. Closing the report removes report layers from the main map.
3. Print report (or Print on a card) expands collapsed collection rows and details blocks.
4. CSV/JSON export from a table widget downloads a file whose columns match the on-screen table.
5. Show on main map from a distance widget puts the route on the project map. Remove from main map clears it.
6. Collection reports group child sketches. Expanding a row shows per-child metrics.
7. Geography size, feature count, presence, feature list, column statistics, raster band statistics, class composition, histograms, time series, intersecting features, sketch attributes table, and MPA guide cards each render with fixture layers. One journey per card type is enough.
8. Distance to shore and distance to port render a map and a number on a clipped sketch.
9. The fuel-assumptions tab on a distance-to-point map shows a one-way cost from the published defaults.

---

## Offline

Intent: a participant still has the map and can take a survey with the network down. **Do not farm these until the downstream plan in the [catalog index](journeys.md) exists.** Tag: `@offline`. **bundler-risk** if offline surveys remain a supported feature. If they do not, record the drop in the index and delete the Workbox plugin with Create React App. Admin tile packages are in the [admin catalog](journeys-admin.md#offline-tile-packages).

1. A signed-in user opens project cache settings (`/:slug/app/settings`) and sees data-caching level and basemap download when offline support is enabled for the project.
2. After caching, going offline still opens the project map from the service worker (basemap and a cached overlay).
3. `/account-settings` shows the same cache controls for the signed-in user.
4. The offline homepage overlay lists cached projects and surveys.
5. A published survey can be cached, taken offline, and the answers queue locally.
6. `/submit-offline-surveys` submits the queue when the browser is back online, and the response is stored.
