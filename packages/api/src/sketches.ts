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
import { makeNodeFetchRangeFn } from "./nodeFetchRangeFn";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

// Source cache used for local clipping in test mode
const sourceCache = new SourceCache(process.env.SOURCE_CACHE_SIZE || "256MB", {
  fetchRangeFn: makeNodeFetchRangeFn(`https://uploads.seasketch.org/`)
    .fetchRangeFn,
});

let lambdaClient: LambdaClient | null = null;
function getLambdaClient() {
  if (!lambdaClient) {
    lambdaClient = new LambdaClient({
      region: process.env.AWS_REGION || "us-west-2",
    });
  }
  return lambdaClient;
}

type CreateFragmentsResult = {
  success: boolean;
  clipped?: Feature<MultiPolygon> | null;
  fragments?: FragmentResult[];
  error?: string;
};

type CreateCollectionFragmentsResult = {
  success: boolean;
  fragmentsBySketchId?: Record<number, FragmentResult[]>;
  error?: string;
};

/**
 * Delegates clipToGeographies work to the fragment-worker AWS Lambda.
 */
async function callFragmentWorkerLambda(
  userGeom: Feature<any>,
  geographies: GeographySettings[],
  geographiesForClipping: number[],
  existingOverlappingFragments: SketchFragment[],
  existingSketchId: number | null,
): Promise<{
  clipped: Feature<MultiPolygon> | null;
  fragments: FragmentResult[];
}> {
  if (!process.env.FRAGMENT_WORKER_LAMBDA_ARN) {
    throw new Error("FRAGMENT_WORKER_LAMBDA_ARN is not configured");
  }

  const payload = {
    feature: userGeom,
    geographies,
    geographiesForClipping,
    existingOverlappingFragments,
    existingSketchId,
  };

  const client = getLambdaClient();
  console.time("invoke lambda");
  const command = new InvokeCommand({
    FunctionName: process.env.FRAGMENT_WORKER_LAMBDA_ARN,
    InvocationType: "RequestResponse",
    Payload: Buffer.from(JSON.stringify(payload)),
  });
  const response = await client.send(command);
  console.timeEnd("invoke lambda");

  if (response.FunctionError) {
    const errorPayload = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : null;
    throw new Error(
      `Fragment worker Lambda error: ${
        errorPayload?.errorMessage || response.FunctionError
      }`,
    );
  }

  if (!response.Payload) {
    throw new Error("Fragment worker Lambda returned no payload");
  }

  const result: CreateFragmentsResult = JSON.parse(
    Buffer.from(response.Payload).toString(),
  );

  if (!result.success) {
    throw new Error(
      `Fragment worker Lambda error: ${result.error || "Unknown error"}`,
    );
  }

  return {
    clipped: result.clipped ?? null,
    fragments: result.fragments ?? [],
  };
}

async function callFragmentWorkerCollectionLambda(
  sketches: Array<{ id: number; feature: Feature<any> }>,
  geographies: GeographySettings[],
  geographiesForClipping: number[],
): Promise<Record<number, FragmentResult[]>> {
  if (!process.env.FRAGMENT_WORKER_LAMBDA_ARN) {
    throw new Error("FRAGMENT_WORKER_LAMBDA_ARN is not configured");
  }
  const payload = {
    operation: "create-collection-fragments",
    sketches,
    geographies,
    geographiesForClipping,
  };
  const client = getLambdaClient();
  const command = new InvokeCommand({
    FunctionName: process.env.FRAGMENT_WORKER_LAMBDA_ARN,
    InvocationType: "RequestResponse",
    Payload: Buffer.from(JSON.stringify(payload)),
  });
  const response = await client.send(command);
  if (response.FunctionError) {
    const errorPayload = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : null;
    throw new Error(
      `Fragment worker Lambda error: ${
        errorPayload?.errorMessage || response.FunctionError
      }`,
    );
  }
  if (!response.Payload) {
    throw new Error("Fragment worker Lambda returned no payload");
  }
  const result: CreateCollectionFragmentsResult = JSON.parse(
    Buffer.from(response.Payload).toString(),
  );
  if (!result.success) {
    throw new Error(
      `Fragment worker Lambda error: ${result.error || "Unknown error"}`,
    );
  }
  return result.fragmentsBySketchId ?? {};
}

/**
 * Fire-and-forget invocation of the fragment-worker Lambda to warm its FGB
 * source caches for the given sketch bounding box. Returns immediately; the
 * Lambda runs asynchronously.
 */
export async function warmFragmentWorkerCache(
  userGeom: Feature<any>,
  geographies: GeographySettings[],
): Promise<void> {
  if (!process.env.FRAGMENT_WORKER_LAMBDA_ARN) {
    return;
  }

  const client = getLambdaClient();
  const command = new InvokeCommand({
    FunctionName: process.env.FRAGMENT_WORKER_LAMBDA_ARN,
    InvocationType: "Event",
    Payload: Buffer.from(
      JSON.stringify({
        operation: "warm-cache",
        feature: userGeom,
        geographies,
      }),
    ),
  });
  await client.send(command);
}

export async function getFeatureCollection(
  surveyId: number,
  formElementId: number,
  client: DBClient,
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
    [formElementId],
  );
  const formElements = rows;
  for (const element of formElements) {
    element.exportId = createExportId(
      element.id,
      element.body,
      element.exportId,
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
  pgClient: PoolClient,
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
      [id],
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
    [id, type],
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
    [copyId, type],
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
  pgClient: PoolClient,
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
    [JSON.stringify(tocItems)],
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
      [folderId],
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
        [item.id],
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
        [item.id],
      );
      const currentCollectionId = folder.get_parent_collection_id;
      if (currentCollectionId !== targetCollectionId) {
        // need to get all the contained sketches
        const {
          rows: [folderSketches],
        } = await pgClient.query(
          `select get_child_sketches_recursive($1, 'sketch_folder')`,
          [item.id],
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
    [collectionId, folderId, sketches],
  );
  // update collection_id and folder_id on related folders
  await pgClient.query(
    `update sketch_folders set collection_id = $1, folder_id = $2 where id = any($3)`,
    [collectionId, folderId, folders],
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
          { removeOverlap: true },
        );
        if (fragments.length === 0) {
          // no fragments to reconcile, nothing to do
          // May be a legacy sketch class
          continue;
        }
        fragmentDeletionScope.push(
          ...fragments.map((f) => f.properties.__hash as string),
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
            pgClient,
          );
          fragmentDeletionScope.push(
            ...overlappingFragments.map((f) => f.properties.__hash as string),
          );
          // Need to run the whole fragment reconciliation process with
          // overlapping sketches in the collection
          fragments = eliminateOverlap(fragments, overlappingFragments);

          await reconcileFragments(
            siblingSketchIds,
            fragments,
            [...new Set(fragmentDeletionScope)],
            pgClient,
            parseInt(sketchId),
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
  pgClient: PoolClient,
): Promise<{ deletedItems: string[]; previousCollectionIds: number[] }> {
  // Get IDs of collections these items belong to to be included in
  // updatedCollections
  const { rows } = await pgClient.query(
    `
            select distinct(
              get_parent_collection_id(type, id)
            ) as collection_id from json_to_recordset($1) as (type sketch_child_type, id int)`,
    [JSON.stringify(items)],
  );
  const previousCollectionIds = rows.map((r: any) => r.collection_id);
  // Get IDs of all items to be deleted (including their children) to
  // be added to deletedItems output
  const childrenResult = await pgClient.query(
    `
            select distinct(
              get_all_sketch_toc_children(id, type)
            ) as children from json_to_recordset($1) as (type sketch_child_type, id int)`,
    [JSON.stringify(items)],
  );

  const deletedItems: string[] = [
    ...items.map(
      (item: any) =>
        `${/folder/i.test(item.type) ? "SketchFolder" : "Sketch"}:${item.id}`,
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
    ],
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
  pgClient: PoolClient,
): Promise<SketchFragment[]> {
  const geometryArray = envelopes
    .map(
      (e: any) =>
        `ST_MakeEnvelope(${e.minX}, ${e.minY}, ${e.maxX}, ${e.maxY}, 4326)`,
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
    [collectionId, sketchId],
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
  },
): Promise<SketchFragment[]> {
  const { rows } = await pgClient.query(
    `
    select * from get_fragments_for_sketch($1)
    `,
    [sketchId],
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
      ["__geographyIds", "__sketchIds"],
    ) as unknown as SketchFragment[];
  }
  return fragments;
}

export async function getFragmentHashesForSketch(
  sketchId: number,
  pgClient: Pool | PoolClient,
): Promise<string[]> {
  const { rows } = await pgClient.query(
    `select get_fragment_hashes_for_sketch($1)`,
    [sketchId],
  );
  if (
    rows.length > 0 &&
    rows[0].get_fragment_hashes_for_sketch &&
    Array.isArray(rows[0].get_fragment_hashes_for_sketch)
  ) {
    return rows[0].get_fragment_hashes_for_sketch;
  }
  return [];
}

/**
 * Batch lookup of fragment hashes for multiple sketches (single query).
 * Sketches with no fragments or that fail RLS are omitted; caller should
 * initialize missing entries to [] as needed.
 */
export async function getFragmentHashesForSketches(
  sketchIds: number[],
  pgClient: Pool | PoolClient,
): Promise<Record<number, string[]>> {
  if (sketchIds.length === 0) return {};
  const { rows } = await pgClient.query<{
    sketch_id: number;
    fragment_hashes: string[];
  }>(
    `select sketch_id, fragment_hashes from get_fragment_hashes_for_sketches($1::int[])`,
    [sketchIds],
  );
  const result: Record<number, string[]> = {};
  for (const row of rows) {
    result[row.sketch_id] =
      row.fragment_hashes && Array.isArray(row.fragment_hashes)
        ? row.fragment_hashes
        : [];
  }
  return result;
}

let idCounter = 0;

function convertToPendingFragmentResult(
  fragments: SketchFragment[],
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
  deletionScope?: string[],
): Promise<void> {
  if (fragments.length > 80) {
    throw new Error("Too many fragments to update. Maximum is 80.");
  }
  const fragmentInputs =
    fragments.length > 0
      ? fragments
          .map((f) => {
            const geomJson = JSON.stringify(f.geometry);
            const geographyIds = f.properties.__geographyIds.join(",");
            return `ROW(ST_GeomFromGeoJSON('${geomJson}'), ARRAY[${geographyIds}])::fragment_input`;
          })
          .join(",")
      : "";

  const deletionScopeSql =
    deletionScope && deletionScope.length > 0
      ? `ARRAY[${deletionScope.map((hash) => `'${hash}'`).join(",")}]`
      : "NULL";

  const sql = `
    SELECT update_sketch_fragments(
      $1::int, 
      ${
        fragments.length > 0
          ? `ARRAY[${fragmentInputs}]`
          : "ARRAY[]::fragment_input[]"
      },
      ${deletionScopeSql}
    )
  `;

  await pgClient.query(sql, [sketchId]);
}

export async function ensureCollectionFragments(
  collectionId: number,
  projectId: number,
  pgClient: PoolClient,
): Promise<string[]> {
  const childSketchIds = await getChildSketchIds(
    "sketch",
    collectionId,
    pgClient,
  );
  if (childSketchIds.length === 0) {
    return [];
  }

  // Sketches that have polygon/multipolygon user_geom and are missing from sketch_fragments.
  const { rows: missingFragments } = await pgClient.query<{ id: number }>(
    `select s.id
     from sketches s
     where s.id = any($1::int[])
       and s.user_geom is not null
       and ST_GeometryType(s.user_geom) in ('ST_Polygon', 'ST_MultiPolygon')
       and not exists (
         select 1 from sketch_fragments sf where sf.sketch_id = s.id
       )`,
    [childSketchIds],
  );

  if (missingFragments.length === 0) {
    // All polygon sketches already have fragments; return their hashes (batch query).
    const { rows: withPolygonGeom } = await pgClient.query<{ id: number }>(
      `select id from sketches
       where id = any($1::int[])
         and user_geom is not null
         and ST_GeometryType(user_geom) in ('ST_Polygon', 'ST_MultiPolygon')`,
      [childSketchIds],
    );
    const polygonSketchIds = withPolygonGeom.map((r) => r.id);
    const batchHashes = await getFragmentHashesForSketches(
      polygonSketchIds,
      pgClient,
    );
    return [...new Set(Object.values(batchHashes).flat())];
  }

  // Need to generate fragments: load user_geom (GeoJSON) for the Lambda.
  const { rows: sketchesForLambda } = await pgClient.query<{
    id: number;
    sketch_class_id: number;
    user_geom: string;
  }>(
    `select sketches.id, sketches.sketch_class_id, ST_AsGeoJSON(sketches.user_geom) as user_geom
     from sketches
     where sketches.id = any($1::int[])
       and sketches.user_geom is not null
       and ST_GeometryType(sketches.user_geom) in ('ST_Polygon', 'ST_MultiPolygon')`,
    [childSketchIds],
  );

  const sketchClassIds = Array.from(
    new Set(sketchesForLambda.map((sketch) => sketch.sketch_class_id)),
  );
  if (sketchClassIds.length !== 1) {
    throw new Error(
      `Collection ${collectionId} has sketches with different sketch classes; cannot generate fragments in a single batch`,
    );
  }
  const sketchClassId = sketchClassIds[0];

  const { rows: clippingLayers } = await pgClient.query(
    `
    select * from clipping_layers_for_sketch_class($1, $2)
    `,
    [projectId, sketchClassId],
  );
  const geographies = clippingLayers.reduce(
    (acc: GeographySettings[], l: any) => {
      let geography: GeographySettings | undefined = acc.find(
        (g) => g.id === l.geography_id,
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
          `Clipping layer ${l.id} has no object key. There was likely a problem finding an appropriate data_upload_output`,
        );
      }
      geography.clippingLayers.push({
        op: l.operation_type.toUpperCase(),
        source: l.object_key,
        cql2Query: l.cql2_query,
      });
      return acc;
    },
    [] as GeographySettings[],
  );

  const clippingGeographyLayers = Array.from(
    new Set(
      clippingLayers
        .filter((l: any) => l.for_clipping)
        .map((l: any) => l.geography_id),
    ),
  );

  const fragmentsBySketchId = await callFragmentWorkerCollectionLambda(
    sketchesForLambda.map((sketch) => ({
      id: sketch.id,
      feature: {
        type: "Feature",
        properties: {},
        geometry: JSON.parse(sketch.user_geom),
      } as Feature<any>,
    })),
    geographies,
    clippingGeographyLayers,
  );

  for (const sketch of sketchesForLambda) {
    const existingHashes = await getFragmentHashesForSketch(
      sketch.id,
      pgClient,
    );
    const fragments = fragmentsBySketchId[sketch.id] || [];
    await updateSketchFragments(sketch.id, fragments, pgClient, existingHashes);
    await pgClient.query(
      `
      update sketches s
      set geom = (
        select
          case
            when count(*) = 0 then null
            else ST_Multi(ST_CollectionExtract(ST_Union(f.geometry), 3))
          end
        from sketch_fragments sf
        join fragments f on f.hash = sf.fragment_hash
        where sf.sketch_id = s.id
      )
      where s.id = $1
      `,
      [sketch.id],
    );
  }
  const batchHashes = await getFragmentHashesForSketches(
    sketchesForLambda.map((s) => s.id),
    pgClient,
  );
  return [...new Set(Object.values(batchHashes).flat())];
}

export async function ensureSketchFragments(
  sketchId: number,
  projectId: number,
  pgClient: PoolClient,
  options?: { resetClippedGeometry?: boolean },
): Promise<string[]> {
  const existingHashes = await getFragmentHashesForSketch(sketchId, pgClient);
  if (existingHashes.length > 0) {
    return existingHashes;
  }

  const {
    rows: [sketchRow],
  } = await pgClient.query<{
    id: number;
    name: string;
    user_id: number;
    properties: any;
    sketch_class_id: number;
    project_id: number;
    geometry_type: string;
    use_geography_clipping: boolean;
    preview_new_reports: boolean;
    user_geom: string | null;
  }>(
    `
    select
      sketches.id,
      sketches.name,
      sketches.user_id,
      sketches.properties,
      sketches.sketch_class_id,
      sketch_classes.project_id,
      sketch_classes.geometry_type,
      sketch_classes_use_geography_clipping(sketch_classes.*) as use_geography_clipping,
      coalesce(sketch_classes.preview_new_reports, false) as preview_new_reports,
      ST_AsGeoJSON(sketches.user_geom) as user_geom
    from sketches
    join sketch_classes on sketch_classes.id = sketches.sketch_class_id
    where sketches.id = $1
    `,
    [sketchId],
  );

  if (!sketchRow) {
    throw new Error(`Sketch ${sketchId} not found`);
  }

  if (sketchRow.geometry_type === "FILTERED_PLANNING_UNITS") {
    return [];
  }

  if (!sketchRow.use_geography_clipping && !sketchRow.preview_new_reports) {
    return [];
  }

  if (sketchRow.geometry_type === "COLLECTION") {
    throw new Error("Collection geometry type is not supported yet");
    // const hashes = await ensureCollectionFragments(
    //   sketchId,
    //   projectId || sketchRow.project_id,
    //   pgClient,
    // );
    // const collectionHashes = await getFragmentHashesForSketch(
    //   sketchId,
    //   pgClient,
    // );
    // if (collectionHashes.length > 0) {
    //   return collectionHashes;
    // }
    // return hashes;
  }

  if (!sketchRow.user_geom) {
    throw new Error("ensureSketchFragments - Sketch has no geometry");
  }

  const userGeom = {
    type: "Feature" as const,
    properties: {},
    geometry: JSON.parse(sketchRow.user_geom),
  };

  const { clipped, fragments, fragmentDeletionScope } =
    await generateFragmentsForSketchGeometry({
      userGeom,
      sketchClassId: sketchRow.sketch_class_id,
      projectId: projectId || sketchRow.project_id,
      collectionId: null,
      folderCollectionId: null,
      sketchId,
      pgClient,
    });

  await reconcileFragments(
    [],
    fragments,
    fragmentDeletionScope,
    pgClient,
    sketchId,
  );

  if (options?.resetClippedGeometry) {
    await pgClient.query(
      `update sketches set geom = ST_GeomFromGeoJSON($1) where id = $2`,
      [JSON.stringify(clipped.geometry), sketchId],
    );
  }

  return getFragmentHashesForSketch(sketchId, pgClient);
}

/**
 * Generates clipped geometry and fragments for a sketch using project geography
 * clipping. Does not update the sketch row or any other sketch properties.
 * Used by createOrUpdateSketch and ensureSketchFragments (standalone path).
 */
async function generateFragmentsForSketchGeometry(params: {
  userGeom: Feature<any>;
  sketchClassId: number;
  projectId: number;
  collectionId: number | null;
  folderCollectionId: number | null;
  sketchId: number | null;
  pgClient: PoolClient;
}): Promise<{
  clipped: Feature<MultiPolygon>;
  fragments: FragmentResult[];
  fragmentDeletionScope: string[];
}> {
  const {
    userGeom,
    sketchClassId,
    projectId,
    collectionId,
    folderCollectionId,
    sketchId,
    pgClient,
  } = params;

  const preparedSketch = prepareSketch(userGeom);

  let { rows: clippingLayers } = await pgClient.query(
    `select * from clipping_layers_for_sketch_class($1, $2)`,
    [projectId, sketchClassId],
  );

  const geographies = clippingLayers.reduce(
    (acc: GeographySettings[], l: any) => {
      let geography: GeographySettings | undefined = acc.find(
        (g) => g.id === l.geography_id,
      );
      if (!geography) {
        geography = { id: l.geography_id, clippingLayers: [] };
        acc.push(geography);
      }
      if (l.object_key === null) {
        throw new Error(
          `Clipping layer ${l.id} has no object key. There was likely a problem finding an appropriate data_upload_output`,
        );
      }
      geography.clippingLayers.push({
        op: l.operation_type.toUpperCase(),
        source: l.object_key,
        cql2Query: l.cql2_query,
      });
      return acc;
    },
    [] as GeographySettings[],
  );

  const clippingGeographyLayers = Array.from(
    new Set(
      clippingLayers
        .filter((l: any) => l.for_clipping)
        .map((l: any) => l.geography_id),
    ),
  );

  const existingOverlappingFragments: SketchFragment[] =
    collectionId || folderCollectionId
      ? await overlappingFragmentsInCollection(
          collectionId || folderCollectionId!,
          sketchId,
          preparedSketch.envelopes,
          pgClient,
        )
      : [];

  const fragmentDeletionScope = existingOverlappingFragments.map(
    (f) => f.properties.__hash,
  );

  const distinctGeographyIds = new Set(clippingGeographyLayers);
  if (distinctGeographyIds.size !== clippingGeographyLayers.length) {
    throw new Error("Clipping geography layers contains duplicate values");
  }

  let clipped: Feature<MultiPolygon> | null;
  let fragments: FragmentResult[];

  if (process.env.NODE_ENV === "test") {
    const result = await clipToGeographies(
      preparedSketch,
      geographies,
      clippingGeographyLayers,
      existingOverlappingFragments,
      sketchId,
      async (feature, objectKey, op, cql2Query) => {
        const source =
          await sourceCache.get<Feature<Polygon | MultiPolygon>>(objectKey);
        return clipSketchToPolygons(
          feature,
          op,
          cql2Query,
          source.getFeaturesAsync(feature.envelopes),
        );
      },
    );
    clipped = result.clipped;
    fragments = result.fragments;
  } else {
    const workerResult = await callFragmentWorkerLambda(
      userGeom,
      geographies,
      clippingGeographyLayers,
      existingOverlappingFragments,
      sketchId,
    );
    clipped = workerResult.clipped;
    fragments = workerResult.fragments;
  }

  if (!clipped) {
    throw new Error("Clipping failed. No geometry returned.");
  }

  return { clipped, fragments, fragmentDeletionScope };
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
      [sketchId, userId],
    );
    if (rows.length === 0) {
      throw new Error("Sketch not found");
    }
  }

  let resolvedCollectionId = collectionId ?? undefined;
  let folderCollectionId: number | null = null;
  if (sketchId) {
    const {
      rows: [sketch],
    } = await pgClient.query(`SELECT get_parent_collection_id('sketch', $1)`, [
      sketchId,
    ]);
    resolvedCollectionId = sketch?.get_parent_collection_id ?? undefined;
  }
  if (folderId) {
    const {
      rows: [folder],
    } = await pgClient.query(
      `SELECT get_parent_collection_id('sketch_folder', $1)`,
      [folderId],
    );
    folderCollectionId = folder?.get_parent_collection_id ?? null;
  }

  const { clipped, fragments, fragmentDeletionScope } =
    await generateFragmentsForSketchGeometry({
      userGeom,
      sketchClassId,
      projectId,
      collectionId: resolvedCollectionId ?? null,
      folderCollectionId,
      sketchId: sketchId ?? null,
      pgClient,
    });

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
        JSON.stringify(clipped.geometry),
        properties,
        sketchId,
      ],
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
        JSON.stringify(clipped.geometry),
        folderId,
        properties,
      ],
    );
    sketchId = sketch.id;
  }

  const targetCollectionId =
    resolvedCollectionId ?? collectionId ?? folderCollectionId;
  await reconcileFragments(
    targetCollectionId
      ? await getChildSketchIds("sketch", targetCollectionId, pgClient)
      : [],
    fragments,
    fragmentDeletionScope,
    pgClient,
    sketchId,
  );

  await pgClient.query(
    `
    select enqueue_metric_calculations_for_sketch($1)`,
    [sketchId!],
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
  sketchId?: number,
) {
  const fragmentGroups = groupFragmentsBySketchId(fragments, sketchId);
  const ids = [...new Set([...(sketchId ? [sketchId] : []), ...siblingIds])];
  await updateGroupedSketchFragments(
    fragmentGroups,
    pgClient,
    ids,
    fragmentDeletionScope,
  );
}

function groupFragmentsBySketchId(
  fragments: FragmentResult[],
  defaultSketchId?: number,
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
  fragmentDeletionScope?: string[],
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
      fragmentDeletionScope,
    );
  }
}

async function getChildSketchIds(
  type: "sketch" | "sketch_folder",
  id: number,
  pgClient: PoolClient,
): Promise<number[]> {
  const { rows } = await pgClient.query(
    `SELECT get_child_sketches_recursive($1, $2)`,
    [id, type],
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
  pgClient: PoolClient,
): Promise<number[]> {
  // first, get the parent collection id
  const { rows } = await pgClient.query(
    `SELECT get_parent_collection_id('sketch', $1)`,
    [sketchId],
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
