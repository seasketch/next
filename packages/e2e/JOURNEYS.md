# Journeys to add before Phase 2

These are browser journeys, in the same suite as the three `@smoke` tests. They characterize the core app so a Node or workspace change fails here instead of in a later deploy.

The three smoke journeys stay as they are: an anonymous visitor opens `demo-samoa` and sees the map, `e2e|member` opens `e2e-private` and sees only the Members Forum, and `e2e|admin` opens the `demo-samoa` admin page.

Reads use `demo-samoa`. A signed-in user starts these journeys as a non-participant. Joining the project happens in the test, on the join page, and only then can they post. Each run starts from a fresh snapshot, so a reply is left in place.

## Fixture additions

One public forum and one topic on `demo-samoa`. Nothing else.

- A forum named **Public Forum**, readable by anyone and open for posts by participants.
- One topic in that forum, **Welcome to the project**, with a single post written by `e2e|admin`.

Geography layers, their metadata, the Marine Protected Area sketch class, the default report, Light and Satellite basemaps, and Samoan are already in the snapshot.

# demo-samoa project

## Discussion Forums

- An anonymous user can navigate from `/demo-samoa/app` to Discussion Forums, open the Public Forum, and view the existing topic. The thread shows "Sign in or register for an account to participate in the forum." There is no reply form.
- A registered non-admin (`e2e|member`) opens the same thread. They have not joined `demo-samoa`, so there is no reply form. The thread asks them to join so they can use the discussion forums, and offers Join Project.
- They choose Join Project and land on the join page, which explains how their profile will be used and shows the profile form. Full Name is empty. Submitting in that state stays on the page, marks Full Name as Required, and does not join the project.
- They enter a full name and submit again. They return to the same thread as a participant and see the reply form.
- They type a reply, submit it, and see that reply in the thread.
- `e2e|admin` opens the same thread with the map already loaded, chooses Share, then Map Bookmark, and posts a reply. The post shows the client thumbnail. The info button opens the bookmark details, and the large screenshot captured by the local worker is shown there.
- `e2e|admin` opens Public Forum and chooses Post a topic. A normal title and a title of eighty emoji can be posted. Eighty-one characters, including eighty-one emoji, show “Titles must be 80 characters or fewer” under the editor and disable Post New Topic. The title row itself does not grow. Posting with no title asks for one. A title with no message asks for a message. A title and message within the limits create the topic.

## Overlay Layers

- An anonymous user opens Overlay Layers and sees the public Geography layers folder. Expanding it lists Exclusive Economic Zone, Land, and Territorial Seas.
- Checking Exclusive Economic Zone turns that layer on. Expanding the legend lists the same layer. Unchecking it removes the layer from the legend.
- Right-clicking Exclusive Economic Zone opens the context menu. Choosing "View metadata" opens a modal whose body includes "Exclusive economic zones joined to land, from Marine Regions."
- Typing "Territorial" into the layer search leaves Territorial Seas visible and hides Land.

## Basemaps

- An anonymous user opens Maps and sees Light and Satellite. Light is the active basemap.
- Choosing Satellite switches the basemap. The map stays loaded, Satellite is shown as the active basemap, and the map stylesheet includes Mapbox satellite raster tiles.

## Language

- An anonymous user opens the project menu and sees English and Samoan in the language list.
- Choosing Samoan changes the sidebar. Discussion Forums reads "Fa'atalanoaga Lautele". Choosing English again restores "Discussion Forums".

## Project admin

`e2e|admin` is already on the admin page in the smoke test. These continue from there, and they only read.

- Data Layers lists the published Geography layers folder and the three layers inside it.
- Geography lists Exclusive Economic Zone, Territorial Seas, and Offshore.
- Sketch Classes lists Marine Protected Area.
- Reports lists Default report.

## Data uploads

`tests/uploads.spec.ts`, against the e2e stack's own data services: local R2 on 18333, the tiles host on 18787, the uploads host on 18788, and the spatial-uploads container. Each upload gets a unique filename so the new layer is the only tree item with that title in a reused database.

- `e2e|admin` opens Data Layers, switches to Overlay Layers, and drops a small GeoJSON of three polygons near Samoa on the layer list. The first upload from an account asks about the AI Cartographer; the test declines. The job completes, its outputs are FlatGeobuf and GeoJSON, every URL is on the uploads host and every `remote` names `ssn-tiles-local`. The uploads host serves the GeoJSON and the original file, and the map fetches the layer from it.
- The same admin uploads a generated GeoJSON of 120 polygons, large enough to be tiled. The outputs include PMTiles on the tiles host, the data source URL is the archive without its extension, the tiles host answers the TileJSON request with tile URLs pointing back at itself, and the map fetches a vector tile from it.

# Homepage

- An anonymous visitor opens `/` and sees the SeaSketch name, a Sign In control, and a link to Projects.
- Following Projects opens `/projects`, which lists Demo Samoa.
- Opening Demo Samoa from that list lands on the project, with the map loaded and Sign In still available.

# Left for later

Zoom to bounds waits until a later set of layers has bounds that match the project region. End-user Sketching Tools wait as well. Report calculation and downloads stay out of this set. They need more fixture data, or a service the e2e profile does not run. The access gates are `tests/access.spec.ts`. The Maldives ocean-use respondent journey is `tests/survey.spec.ts`, against the survey seeded on `demo-maldives`. It selects two sectors before drawing, finishes each with "Finish Sector", and moves between them with "Next sector". The Coral Restoration Survey on `demo-palawan` is the single-sector case in the same file: the first visit starts drawing without a sector picker, the feature list says "Finish", and coming back shows the sector list with the area count. Authoring, data, and reports stay with Phase 5.
