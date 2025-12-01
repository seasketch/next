import { DBClient } from "./dbClient";
import { normalizeSpatialProperties } from "./ExportUtils";
import { createExportId } from "./plugins/exportIdPlugin";
import { Feature, MultiPolygon, Polygon } from "geojson";
import { SourceCache } from "fgb-source";
import {
  prepareSketch,
  GeographySettings,
  SketchFragment,
  FragmentResult,
  eliminateOverlap,
  mergeTouchingFragments,
  clipSketchToPolygons,
  clipToGeographies,
} from "overlay-engine";
import { Pool, PoolClient } from "pg";
import bbox from "@turf/bbox";
import { PendingFragmentResult } from "overlay-engine/dist/fragments";
import { startMetricCalculationsForSketch } from "./plugins/reportsPlugin";
import { makeNodeFetchRangeFn } from "./nodeFetchRangeFn";

// Initialize source cache for clipping operations
const sourceCache = new SourceCache(process.env.SOURCE_CACHE_SIZE || "256MB", {
  fetchRangeFn: makeNodeFetchRangeFn(`https://uploads.seasketch.org/`)
    .fetchRangeFn,
});

// Lazy load clipping worker manager
let clippingWorkerManager: any;

export async function getFeatureCollection(
  surveyId: number,
  formElementId: number,
  client: DBClient
) {
  const results = await client.query(`select export_spatial_responses($1)`, [
    formElementId,
  ]);
  const collection = results.rows[0].export_spatial_responses;
  const { rows } = await client.query(
    `
    select
      type_id as "typeId",
      component_settings as "componentSettings",
      export_id as "exportId",
      position,
      id,
      form_element_types.is_input as "isInput",
      body
    from
      form_elements
    inner join
      form_element_types
    on
      form_element_types.component_name = form_elements.type_id
    where
      form_elements.form_id = (
        select id from forms where sketch_class_id = (
          select id from sketch_classes where form_element_id = $1
        )
      );
  `,
    [formElementId]
  );
  const formElements = rows;
  for (const element of formElements) {
    element.exportId = createExportId(
      element.id,
      element.body,
      element.exportId
    );
  }
  if (!collection || !collection.features || !collection.features.length) {
    return {
      type: "FeatureCollection",
      features: [],
    };
  } else {
    return normalizeSpatialProperties(surveyId, collection, formElements);
  }
}

export async function copySketchTocItem(
  id: number,
  type: "sketch" | "sketch_folder",
  forForum: boolean,
  pgClient: PoolClient
): Promise<{
  copyId: number;
  sketchIds: number[];
  folderIds: number[];
  parentCollectionId: number | null;
}> {
  if (!forForum) {
    // Security sensitive:
    // Check that the user owns this sketch. RLS will be enforced for
    // this select query, but not for subsequent calls to copy_sketch*,
    // so it's critical to check here.
    const { rows } = await pgClient.query(
      `select user_id from ${
        type === "sketch" ? "sketches" : "sketch_folders"
      } where id = $1`,
      [id]
    );
    if (rows.length === 0) {
      throw new Error(`${type} not found or permission denied`);
    }
  }
  const {
    rows: [row],
  } = await pgClient.query(
    forForum
      ? `select copy_sketch_toc_item_recursive_for_forum($1, $2, false)`
      : `select copy_sketch_toc_item_recursive($1, $2, true)`,
    [id, type]
  );
  const copyId: number = forForum
    ? row.copy_sketch_toc_item_recursive_for_forum
    : row.copy_sketch_toc_item_recursive;
  let {
    rows: [{ get_child_folders_recursive: folderIds }],
  } = await pgClient.query(`select get_child_folders_recursive($1, $2)`, [
    copyId,
    type,
  ]);
  let {
    rows: [{ get_child_sketches_and_collections_recursive: sketchIds }],
  } = await pgClient.query(
    `select get_child_sketches_and_collections_recursive($1, $2)`,
    [copyId, type]
  );
  if (type === "sketch") {
    sketchIds.push(copyId);
  } else {
    folderIds.push(copyId);
  }
  let {
    rows: [{ get_parent_collection_id }],
  } = await pgClient.query(`select get_parent_collection_id($1, $2)`, [
    type,
    copyId,
  ]);
  const parentCollectionId = get_parent_collection_id;

  return {
    copyId,
    sketchIds,
    folderIds,
    parentCollectionId,
  };
}

export async function updateSketchTocItemParent(
  folderId: number | null,
  collectionId: number | null,
  tocItems: { type: "sketch" | "sketch_folder"; id: number }[],
  pgClient: PoolClient
): Promise<{
  sketchIds: number[];
  folderIds: number[];
  previousCollectionIds: number[];
}> {
  const { rows } = await pgClient.query(
    `
    select distinct(
      get_parent_collection_id(type, id)
    ) as collection_id from json_to_recordset($1) as (type sketch_child_type, id int)`,
    [JSON.stringify(tocItems)]
  );
  const previousCollectionIds = rows.map((r: any) => r.collection_id);
  // to implement fragment reconciliation, we need to know for each sketch which
  // collection they are being removed from (if any) and which they are being
  // added to (if any).
  const sketchFragmentChanges: {
    [sketchId: number]: { removedFrom: number | null; addedTo: number | null };
  } = {};

  let targetCollectionId = collectionId;
  if (!targetCollectionId && folderId) {
    const {
      rows: [folder],
    } = await pgClient.query(
      `select get_parent_collection_id('sketch_folder', $1)`,
      [folderId]
    );
    targetCollectionId = folder.get_parent_collection_id;
  }

  for (const item of tocItems) {
    if (item.type === "sketch") {
      // not recursive, just get the parent collection
      const {
        rows: [sketch],
      } = await pgClient.query(
        `select get_parent_collection_id('sketch', $1)`,
        [item.id]
      );
      const currentCollectionId = sketch.get_parent_collection_id;
      if (currentCollectionId === targetCollectionId) {
        // no changes, don't add to sketchFragmentChanges
      } else {
        sketchFragmentChanges[item.id] = {
          removedFrom: currentCollectionId,
          addedTo: targetCollectionId,
        };
      }
    } else if (item.type === "sketch_folder") {
      // recursive, get all the sketches in the folder
      const {
        rows: [folder],
      } = await pgClient.query(
        `select get_parent_collection_id('sketch_folder', $1)`,
        [item.id]
      );
      const currentCollectionId = folder.get_parent_collection_id;
      if (currentCollectionId !== targetCollectionId) {
        // need to get all the contained sketches
        const {
          rows: [folderSketches],
        } = await pgClient.query(
          `select get_child_sketches_recursive($1, 'sketch_folder')`,
          [item.id]
        );
        for (const id of folderSketches.get_child_sketches_recursive) {
          sketchFragmentChanges[id] = {
            removedFrom: currentCollectionId,
            addedTo: targetCollectionId,
          };
        }
      }
    }
  }

  const folders: number[] = tocItems
    .filter((f: any) => f.type === "sketch_folder")
    .map((f: any) => f.id);
  const sketches: number[] = tocItems
    .filter((f: any) => f.type === "sketch")
    .map((f: any) => f.id);
  // update collection_id and folder_id on related sketches
  await pgClient.query(
    `update sketches set collection_id = $1, folder_id = $2 where id = any($3)`,
    [collectionId, folderId, sketches]
  );
  // update collection_id and folder_id on related folders
  await pgClient.query(
    `update sketch_folders set collection_id = $1, folder_id = $2 where id = any($3)`,
    [collectionId, folderId, folders]
  );

  const siblingSketchIds = targetCollectionId
    ? await getChildSketchIds("sketch", targetCollectionId!, pgClient)
    : [];

  // Fragment reconciliation
  if (Object.keys(sketchFragmentChanges).length > 0) {
    for (const sketchId in sketchFragmentChanges) {
      const change = sketchFragmentChanges[sketchId];
      // update_sketch_fragments will remove fragments from a previous
      // collection (if present), so processing change.removedFrom is not
      // necessary
      if (change.addedTo || change.removedFrom) {
        const fragmentDeletionScope = [] as string[];
        // Calling this way will merge fragments which may be split across
        // overlapping sketches from previous collection. It's essentially the
        // same product as running clipToGeographies without the
        // existingOverlappingFragments parameter.
        let fragments = await getFragmentsForSketch(
          parseInt(sketchId),
          pgClient,
          { removeOverlap: true }
        );
        if (fragments.length === 0) {
          // no fragments to reconcile, nothing to do
          // May be a legacy sketch class
          continue;
        }
        fragmentDeletionScope.push(
          ...fragments.map((f) => f.properties.__hash as string)
        );
        if (change.addedTo) {
          const overlappingFragments = await overlappingFragmentsInCollection(
            change.addedTo,
            parseInt(sketchId),
            fragments.map((f) => {
              const box = bbox(f);
              return {
                minX: box[0],
                minY: box[1],
                maxX: box[2],
                maxY: box[3],
              };
            }),
            pgClient
          );
          fragmentDeletionScope.push(
            ...overlappingFragments.map((f) => f.properties.__hash as string)
          );
          // Need to run the whole fragment reconciliation process with
          // overlapping sketches in the collection
          fragments = eliminateOverlap(fragments, overlappingFragments);

          await reconcileFragments(
            siblingSketchIds,
            fragments,
            [...new Set(fragmentDeletionScope)],
            pgClient,
            parseInt(sketchId)
          );
        } else {
          // just need to update_sketch_fragments with the merged fragments
          await updateSketchFragments(parseInt(sketchId), fragments, pgClient);
        }
      } else {
        // no changes to fragments necessary.
      }
    }
  } else {
    // No fragment changes, nothing to do
  }

  return {
    sketchIds: sketches,
    folderIds: folders,
    previousCollectionIds,
  };
}

export async function deleteSketchTocItems(
  items: {
    type: "sketch" | "sketch_folder";
    id: number;
  }[],
  pgClient: PoolClient
): Promise<{ deletedItems: string[]; previousCollectionIds: number[] }> {
  // Get IDs of collections these items belong to to be included in
  // updatedCollections
  const { rows } = await pgClient.query(
    `
            select distinct(
              get_parent_collection_id(type, id)
            ) as collection_id from json_to_recordset($1) as (type sketch_child_type, id int)`,
    [JSON.stringify(items)]
  );
  const previousCollectionIds = rows.map((r: any) => r.collection_id);
  // Get IDs of all items to be deleted (including their children) to
  // be added to deletedItems output
  const childrenResult = await pgClient.query(
    `
            select distinct(
              get_all_sketch_toc_children(id, type)
            ) as children from json_to_recordset($1) as (type sketch_child_type, id int)`,
    [JSON.stringify(items)]
  );

  const deletedItems: string[] = [
    ...items.map(
      (item: any) =>
        `${/folder/i.test(item.type) ? "SketchFolder" : "Sketch"}:${item.id}`
    ),
  ];
  for (const row of childrenResult.rows) {
    if (row.children && row.children.length) {
      for (const id of row.children) {
        if (deletedItems.indexOf(id) === -1) {
          deletedItems.push(id);
        }
      }
    }
  }

  // Do the deleting
  const folders: number[] = items
    .filter((f: any) => f.type === "sketch_folder")
    .map((f: any) => f.id);
  const sketches: number[] = items
    .filter((f: any) => f.type === "sketch")
    .map((f: any) => f.id);

  await pgClient.query(`delete from sketch_folders where id = any($1)`, [
    folders,
  ]);

  // get any fragments hashes related to deleted sketches, using the sketch_fragments many-to-many table
  const { rows: fragmentHashes } = await pgClient.query(
    `select distinct(fragment_hash) as hash from sketch_fragments where sketch_id = any($1)`,
    [
      deletedItems
        .filter((i: any) => i.startsWith("Sketch:"))
        .map((i: any) => parseInt(i.split(":")[1])),
    ]
  );
  const hashes = fragmentHashes.map((f: any) => f.hash);

  await pgClient.query(`delete from sketches where id = any($1)`, [sketches]);

  await pgClient.query(`select cleanup_orphaned_fragments($1)`, [hashes]);

  // results will be populated by resolvers above
  return { deletedItems, previousCollectionIds };
}

export async function preprocess(endpoint: string, feature: Feature<any>) {
  return fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ feature }),
  }).then(async (response) => {
    if (response.ok) {
      const { data, error } = await response.json();
      if (error) {
        throw new Error(`Preprocessing Error: ${error}`);
      }
      return data;
    } else {
      const { data, error } = await response.json();
      if (error) {
        throw new Error(`Preprocessing Error: ${error}`);
      } else {
        throw new Error("Unrecognized response from preprocessor");
      }
    }
  });
}

export async function overlappingFragmentsInCollection(
  collectionId: number,
  sketchId: number | null,
  envelopes: { minX: number; minY: number; maxX: number; maxY: number }[],
  pgClient: PoolClient
): Promise<SketchFragment[]> {
  const geometryArray = envelopes
    .map(
      (e: any) =>
        `ST_MakeEnvelope(${e.minX}, ${e.minY}, ${e.maxX}, ${e.maxY}, 4326)`
    )
    .join(",");

  const { rows: overlappingFragments } = await pgClient.query<{
    hash: string;
    geometry: string;
    sketch_ids: number[];
    geography_ids: number[];
  }>(
    `SELECT 
      hash,
      ST_AsGeoJSON(geometry) as geometry,
      sketch_ids,
      geography_ids 
    FROM overlapping_fragments_for_collection(
      $1::int, 
      ARRAY[${geometryArray}],
      $2::int
    )`,
    [collectionId, sketchId]
  );

  const sketchIds = new Set<number>();
  for (const fragment of overlappingFragments) {
    for (const id of fragment.sketch_ids) {
      sketchIds.add(id);
    }
  }

  const existingOverlappingFragments: SketchFragment[] = [];
  for (const fragment of overlappingFragments) {
    const f: SketchFragment = {
      type: "Feature",
      properties: {
        __hash: fragment.hash,
        __geographyIds: fragment.geography_ids,
        __sketchIds: fragment.sketch_ids,
      },
      geometry: JSON.parse(fragment.geometry),
    };
    existingOverlappingFragments.push(f);
  }

  return existingOverlappingFragments;
}

/**
 * Get all fragments for a sketch, including sketch_ids and geography_ids.
 *
 * @param sketchId - The ID of the sketch to get fragments for.
 * @param pgClient - The PostgreSQL client to use.
 * @param options - Optional parameters.
 * @param options.removeOverlap - If true, limit __sketchIds list to only the
 * requested sketchId, and merge fragments which may be split across overlapping
 * sketches in the same collection.
 * @returns An array of fragments.
 */
export async function getFragmentsForSketch(
  sketchId: number,
  pgClient: PoolClient,
  options?: {
    removeOverlap?: boolean;
  }
): Promise<SketchFragment[]> {
  const { rows } = await pgClient.query(
    `
    select * from get_fragments_for_sketch($1)
    `,
    [sketchId]
  );
  let fragments: SketchFragment[] = rows.map((r: any) => ({
    type: "Feature",
    properties: {
      __hash: r.hash,
      __geographyIds: r.geography_ids,
      __sketchIds: r.sketch_ids,
    },
    geometry: JSON.parse(r.geometry),
  }));
  if (options?.removeOverlap) {
    // remove unrelated sketchIds from fragments
    fragments = fragments.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        __sketchIds: [sketchId],
      },
    }));
    // merge fragments which may be split across overlapping sketches from
    // previous collection
    fragments = mergeTouchingFragments(
      convertToPendingFragmentResult(fragments),
      ["__geographyIds", "__sketchIds"]
    ) as unknown as SketchFragment[];
  }
  return fragments;
}

let idCounter = 0;

function convertToPendingFragmentResult(
  fragments: SketchFragment[]
): PendingFragmentResult[] {
  if (idCounter > 1_000_000) {
    console.warn("resetting idCounter");
    idCounter = 0;
  }
  return fragments.map((f) => {
    const pendingFragment: PendingFragmentResult = {
      ...f,
      properties: {
        ...f.properties,
        __id: idCounter++,
      },
      bbox: bbox(f),
    };
    return pendingFragment;
  });
}

/**
 * Update fragments for a sketch with the given fragments.
 *
 * @param sketchId - The ID of the sketch to update fragments for.
 * @param fragments - The fragments to update.
 * @param pgClient - The PostgreSQL client to use.
 * @param deletionScope - Optional array of fragment hashes to delete.
 */
export async function updateSketchFragments(
  sketchId: number,
  fragments: FragmentResult[],
  pgClient: PoolClient,
  deletionScope?: string[]
): Promise<void> {
  const fragmentInputs = fragments
    .map((f) => {
      const geomJson = JSON.stringify(f.geometry);
      const geographyIds = f.properties.__geographyIds.join(",");
      return `ROW(ST_GeomFromGeoJSON('${geomJson}'), ARRAY[${geographyIds}])::fragment_input`;
    })
    .join(",");

  const deletionScopeSql =
    deletionScope && deletionScope.length > 0
      ? `ARRAY[${deletionScope.map((hash) => `'${hash}'`).join(",")}]`
      : "NULL";

  const sql = `
    SELECT update_sketch_fragments(
      $1::int, 
      ARRAY[${fragmentInputs}],
      ${deletionScopeSql}
    )
  `;

  await pgClient.query(sql, [sketchId]);
}

export async function createOrUpdateSketch({
  pgClient,
  userGeom,
  sketchClassId,
  projectId,
  name,
  collectionId,
  folderId,
  properties,
  userId,
  sketchId,
}: {
  pgClient: PoolClient;
  userGeom: Feature<any>;
  sketchClassId: number;
  projectId: number;
  name: string;
  collectionId?: number;
  folderId?: number;
  properties: any;
  userId: number;
  sketchId?: number;
}): Promise<number> {
  if (!name || name.length < 1) {
    throw new Error("Sketch name is required");
  }

  if (sketchId) {
    // Do a permission check
    const { rows } = await pgClient.query(
      `select * from sketches where id = $1 and user_id = $2`,
      [sketchId, userId]
    );
    if (rows.length === 0) {
      throw new Error("Sketch not found");
    }
  }

  // First, prepare the sketch for clipping (e.g. convert to multipolygon,
  // split at antimeridian, and normalize coordinates)
  const preparedSketch = prepareSketch(userGeom);

  // Get all the clipping layers for geographies in this project, including
  // those used for clipping this sketch class.

  let { rows: clippingLayers } = await pgClient.query(
    `
    select * from clipping_layers_for_sketch_class($1, $2)
    `,
    [projectId, sketchClassId]
  );

  // group by geography_id
  const geographies = clippingLayers.reduce(
    (acc: GeographySettings[], l: any) => {
      let geography: GeographySettings | undefined = acc.find(
        (g) => g.id === l.geography_id
      );
      if (!geography) {
        geography = {
          id: l.geography_id,
          clippingLayers: [],
        };
        acc.push(geography);
      }
      if (l.object_key === null) {
        throw new Error(
          `Clipping layer ${l.id} has no object key. There was likely a problem finding an appropriate data_upload_output`
        );
      }
      geography.clippingLayers.push({
        op: l.operation_type.toUpperCase(),
        source: l.object_key,
        cql2Query: l.cql2_query,
      });
      return acc;
    },
    [] as GeographySettings[]
  );

  // Filter out layers that are not used for clipping this sketch class.
  const clippingGeographyLayers = Array.from(
    new Set(
      clippingLayers
        .filter((l: any) => l.for_clipping)
        .map((l: any) => l.geography_id)
    )
  );

  if (sketchId) {
    // collection_id is not updatable, so we need to check if the sketch is
    // already in a collection
    const {
      rows: [sketch],
    } = await pgClient.query(`SELECT get_parent_collection_id('sketch', $1)`, [
      sketchId,
    ]);
    collectionId = sketch.get_parent_collection_id;
  }
  let folderCollectionId: number | null = null;
  if (folderId) {
    const {
      rows: [folder],
    } = await pgClient.query(
      `SELECT get_parent_collection_id('sketch_folder', $1)`,
      [folderId]
    );
    folderCollectionId = folder.get_parent_collection_id;
  }

  const existingOverlappingFragments: SketchFragment[] =
    collectionId || folderCollectionId
      ? await overlappingFragmentsInCollection(
          collectionId || folderCollectionId!,
          sketchId || null,
          preparedSketch.envelopes,
          pgClient
        )
      : [];

  const fragmentDeletionScope = existingOverlappingFragments.map(
    (f) => f.properties.__hash
  );

  // check that clippingGeographyLayers contains distinct values
  const distinctGeographyIds = new Set(
    clippingGeographyLayers.map((l: any) => l.geography_id)
  );
  if (distinctGeographyIds.size !== clippingGeographyLayers.length) {
    throw new Error("Clipping geography layers contains duplicate values");
  }

  // Clip the sketch to the geographies.
  const { clipped, fragments } = await clipToGeographies(
    preparedSketch,
    geographies,
    clippingGeographyLayers,
    existingOverlappingFragments,
    sketchId || null,
    async (feature, objectKey, op, cql2Query) => {
      // ClippingFn is provided to clipToGeography to handle the actual
      // clipping. This is done to accomadate different architectures. For
      // example, on this API server we don't want to block the event-loop, so
      // we use a worker (via clippingWorkerManager) to handle the clipping.
      const source = await sourceCache.get<Feature<Polygon | MultiPolygon>>(
        objectKey
      );
      if (process.env.NODE_ENV === "test") {
        let count = 0;
        for await (const f of source.getFeaturesAsync(feature.envelopes)) {
          count++;
        }

        return clipSketchToPolygons(
          feature,
          op,
          cql2Query,
          source.getFeaturesAsync(feature.envelopes)
        );
      } else {
        if (!clippingWorkerManager) {
          const manager = await import(
            "./workers/clipping/clippingWorkerManager"
          );
          clippingWorkerManager = manager.clippingWorkerManager;
        }
        return clippingWorkerManager.clipSketchToPolygonsWithWorker(
          feature,
          op,
          cql2Query,
          source.getFeaturesAsync(feature.envelopes)
        );
      }
    }
  );

  if (!clipped) {
    throw new Error("Clipping failed. No geometry returned.");
  }

  if (sketchId) {
    // TODO: note in docs that folder_id and collection_id are not updatable
    const {
      rows: [sketch],
    } = await pgClient.query(
      `UPDATE sketches SET
        name = $1,
        user_geom = ST_GeomFromGeoJSON($2),
        geom = ST_GeomFromGeoJSON($3),
        properties = $4
      WHERE id = $5
      RETURNING id`,
      [
        name,
        JSON.stringify(userGeom.geometry),
        JSON.stringify(clipped?.geometry),
        properties,
        sketchId,
      ]
    );
  } else {
    const {
      rows: [sketch],
    } = await pgClient.query(
      `INSERT INTO sketches(
        name,
        sketch_class_id,
        user_id,
        collection_id,
        user_geom,
        geom,
        folder_id,
        properties
      ) VALUES (
        $1, $2, $3, $4,
        ST_GeomFromGeoJSON($5),
        ST_GeomFromGeoJSON($6),
        $7, $8
      ) RETURNING id`,
      [
        name,
        sketchClassId,
        userId,
        collectionId,
        JSON.stringify(userGeom.geometry),
        JSON.stringify(clipped?.geometry),
        folderId,
        properties,
      ]
    );
    sketchId = sketch.id;
  }

  await reconcileFragments(
    collectionId || folderCollectionId
      ? await getChildSketchIds(
          "sketch",
          collectionId || folderCollectionId!,
          pgClient
        )
      : [],
    fragments,
    fragmentDeletionScope,
    pgClient,
    sketchId
  );

  startMetricCalculationsForSketch(
    pgClient as unknown as Pool,
    sketchId!,
    false
  );

  return sketchId!;
}

/**
 * Reconcile fragments for a sketch and its overlapping siblings in a collection,
 * if applicable, and update fragments in the database. It is important to pass
 * the correct parameters to this function to ensure that fragments are updated
 * correctly.
 *
 * @param siblingIds - The ids of all sibling sketches (not folders) included in
 * the sketch's collection. If the sketch is not in a collection, this should be
 * an empty array.
 * @param fragments - The fragments to save to the database.
 * @param fragmentDeletionScope - When fragments are generated using the overlay
 * engine, existing fragments from the same collection may overlap and need to
 * be split. In order to update fragments correctly in the database, the system
 * needs to know which existing fragments were considered when creating this new
 * batch of fragments. **All hashes for existing fragments that were overlapping
 * and possibly split and removed need to be in this array.**
 * @param pgClient - The database client.
 * @param sketchId - The id of the primary sketch being updated. If the sketch
 * is new, this should be undefined.
 */
async function reconcileFragments(
  siblingIds: number[],
  fragments: FragmentResult[],
  fragmentDeletionScope: string[],
  pgClient: PoolClient,
  sketchId?: number
) {
  const fragmentGroups = groupFragmentsBySketchId(fragments, sketchId);
  // const fragmentDeletionScope = [
  //   ...new Set(...fragments.map((f) => f.properties.__hash as string)),
  // ];
  const ids = [...new Set([...(sketchId ? [sketchId] : []), ...siblingIds])];
  await updateGroupedSketchFragments(
    fragmentGroups,
    pgClient,
    ids,
    fragmentDeletionScope
  );
}

function groupFragmentsBySketchId(
  fragments: FragmentResult[],
  defaultSketchId?: number
) {
  const fragmentGroups: { [sketchId: number]: FragmentResult[] } = {};
  for (const fragment of fragments) {
    for (let id of fragment.properties.__sketchIds) {
      if (id === 0) {
        id = defaultSketchId!;
      }
      if (!fragmentGroups[id]) {
        fragmentGroups[id] = [];
      }
      fragmentGroups[id].push(fragment);
    }
  }
  return fragmentGroups;
}

async function updateGroupedSketchFragments(
  fragmentGroups: { [sketchId: number]: FragmentResult[] },
  pgClient: PoolClient,
  filterToSketchIds: number[],
  fragmentDeletionScope?: string[]
) {
  for (const [idForSketch, fragments] of Object.entries(fragmentGroups)) {
    if (filterToSketchIds.indexOf(parseInt(idForSketch)) === -1) {
      // Skip updating fragments if sketch is not in filterToSketchIds
      continue;
    }
    await updateSketchFragments(
      parseInt(idForSketch),
      fragments,
      pgClient,
      fragmentDeletionScope
    );
  }
}

async function getChildSketchIds(
  type: "sketch" | "sketch_folder",
  id: number,
  pgClient: PoolClient
): Promise<number[]> {
  const { rows } = await pgClient.query(
    `SELECT get_child_sketches_recursive($1, $2)`,
    [id, type]
  );
  if (rows.length === 0) {
    return [];
  } else if (rows.length === 1) {
    return rows[0].get_child_sketches_recursive;
  } else {
    throw new Error("get_child_sketches_recursive returned multiple rows");
  }
}

async function getSiblingSketchIds(
  sketchId: number,
  pgClient: PoolClient
): Promise<number[]> {
  // first, get the parent collection id
  const { rows } = await pgClient.query(
    `SELECT get_parent_collection_id('sketch', $1)`,
    [sketchId]
  );
  if (rows.length === 0) {
    return [];
  } else if (rows.length === 1) {
    const collectionId = rows[0].get_parent_collection_id;
    if (!collectionId) {
      return [];
    }
    return await getChildSketchIds("sketch", collectionId, pgClient);
  } else {
    throw new Error("get_parent_collection_id returned multiple rows");
  }
}
