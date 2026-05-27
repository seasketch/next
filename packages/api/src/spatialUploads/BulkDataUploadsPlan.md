# Improved Bulk Data Upload Processing

SeaSketch currently supports drag & drop upload of vector and raster data sources in supported formats. Each file is processed individually and turned into map tiles and represented as a Table of Contents Item in the overlay list. Multiple files can be drag & dropped at once, but each is processed as it's own job. This system works, but has some significant challenges with certain file types and I would like to add some features that require working with files grouped together with others uploaded at the same time.

1. Esri Shapefiles are a challenge. Users must combine all the .shp and "sidecar" files into a zip archive, otherwise they are rejected. Per GIS convention (and required for processing in SeaSketch), all files a part of the same data layer are named the same, and only differ in extension. There's really no reason the server or client couldn't determine which files are part of which layers by recognizing .shp extensions using this convention, it's just that it can handle a single file per data upload processing job. I'd like to move towards a system where a whole list of different shapefiles and their sidecar files can be dropped into SeaSketch together and be accepted and produce multiple layers. This support should also extend to geotiffs (and maybe others?), as they often have xml sidecar files that may include useful metadata.
2. Users may have a whole set of shapefiles (and geotiffs, geojson, fgb's, etc) all organized on their computer in nested folders. In tools like Google Drive I can just drag & drop the whole folder and have that folder structure represented in Drive. I'd like SeaSketch to be able to do the same thing.
3. There are multi-layer formats, mostly vector, like .gdb that I would like to support. I believe these even support "groups" that could be represented as folder-type table of contents items. I'd like to be able to upload a gdb and have all those layers processed in parallel, but end up grouped into at least a single top-level folder (named after the gdb) + nested in subfolders as appropriate if the gdb layers are nested into different groups.

4) In the case of a user uploading a whole big list of unorganized layers (say > 5), I'd like to ask them whether they would like to organize them into existing an existing folder structure (if it exists) or a new set of folders. In each case a language model would be given a list of the existing folders and the filenames and metadata (geostats) of each new layer. The model would then specify for each layer which existing folders or newly created folders the layers should go into (if any).

All these new features and improvements imply a much more significant system that one that just treats each file individually, and would require coordination between the client and server. It also requires user input at multiple steps, rather than just a single upload action.

## New System Architecture

To me, this suggests something like this sort of architecture:

- The server ought to support a "submit data upload job" mutation that points to multiple, already uploaded files. Right now there's something analogous that just supports one. The client should be clever enough to recognize and group uploads with the same filename but differing extensions, and group them. This should happen only for known sidecar-file-supporting spatial data formats.
- For the case of users dragging & dropping whole folder structures into the app, the submission mutation ought to be able to accept a multi-level heirarchy of parent folder names along with the file(s) to be processed. The later processing step that creates db records for the tiled data layer should perform a get-or-create process to create those folders. Each file is still an individual job, but they share similar parent folder definitions so they end up in the right places together at the end.
- While we are at it, that mutation ought to accept an existing folder target in which to create layer(s) and folder(s). The client doesn't currently support dragging uploads into a specific folder, but could in the future.
- Multi-layer formats will produce multiple data upload output groups, along with some sort of list of folder groupings and data structure that specifies what goes into what. Already, the type signatures of some of the data processing workflows imply that multiple layers can be produced, but it's not really supported fully. We'd also need to add that folder support.
- The job-creation mutation should accept a boolean that controls whether or not to use "ai folder placement" for the produced layer(s). This could happen essentially individually, with a model being used to determine if an existing folder should be used, a new folder created, or the layer just stuck in the root. Where it is "group aware" is that the job/mutation should accept a list of filenames in it's "cohort". This way the model can look at the list and inform it's judgement on what should be created for the layer at hand -- but in the context of everything that was uploaded with it. If say, a bunch of files with names like "gfw_longline.fgb", "gfw_trolling.fgb", "gfw_all.geojson.json" are uploaded, it might strongly imply "Oh I should create a Global Fishing Watch" folder. Each job hopefully would determine the same, and they'd all end up in the same folder since it is a get-or-create type operation for folders.

### GraphQL Mutation and DB Schema

There's already a createDataUpload graphql mutation in DataUploads.graphql. It looks like the following:

```gql
mutation createDataUpload($projectId: Int!, $filename: String!, $contentType: String!, $replaceTableOfContentsItemId: Int) {
  createDataUpload(input: { filename: $filename, projectId: $projectId, contentType: $contentType, replaceTableOfContentsItemId: $replaceTableOfContentsItemId }) {
    dataUploadTask {
      ...DataUploadExtendedDetails
      presignedUploadUrl
    }
  }
}
```

I think the new mutation would need to look more like this:

```gql

type SpatialUploadFile {
  filename: String!
  contentType: String!
}

mutation createDataUpload(
  $projectId: Int!
  $files: [SpatialUploadFile!]!
  $replaceTableOfContentsItemId: Int
  $cohortFilenames: [String!]
  $targetFolder: Int
  $uploadFolderBreadcrumbs: [String!]
) {
  createDataUpload(
    input: {
      files: $files
      projectId: $projectId
      replaceTableOfContentsItemId: $replaceTableOfContentsItemId
      cohortFilenames: $cohortFilenames
      targetFolder: $targetFolder
      uploadFolderBreadcrumbs: $uploadFolderBreadcrumbs
    }
  ) {
    dataUploadTask {
      ...DataUploadExtendedDetails
      presignedUploadUrls {
        filename: String!
        presignedUploadUrl: String!
      }
    }
  }
}

```

If replaceTableOfContentsItemId is set and there are multiple files, an exception should probably be thrown. Or we could keep this mutation around for that purpose and create a new one for this type of upload. Really, the replaceTableOfContentsItemId-based workflow should probably get it's own createReplacementDataUpload mutation.

This all implies a significant updating of the data_upload_tasks table to accomadate all this extra information and flow that through to the various processing steps. I'll leave the job of figuring that out to the reader.

### Thoughts on Folder-placement inference

We already have multiple chatgpt-api calls after processing parts of a layer. We send geostats/rasterinfo and other layer metadata to inform layer title choice, attribution, and cartography. All these calls are done in parallel. We should incorporate suggested folder placement in the same step, depending on whether the job requests it. In fact, the process ought to be implemented in the same module as these other tasks (packages/ai-data-analyst).

When choosing folder structure, the llm will need the following context:

- The subject layer filename and geostats or rasterinfo
- The filenames of all other files in it's "cohort" (e.g. the same drag & drop action)
- The list of all existing folders in the system. This get's a little tricky
  - It needs to be all folders in the draft toc tree, in a data structure that provides their relationship (e.g. subfolders)
  - For each folder, if there are layers within, we should include in the context a sample of layer names. If the intended use of the folder is not clear from just the name, this will help. We don't want this context to get out of control though. We may need to select something like a max of 5 layer names per project, and even possibly prune that if there are > 12 folders to something smaller
- If the model chooses to place within an existing folder, it should specify a folder id. Otherwise it might just be a name, optionally with a parent folder id.

If a target folder is already specified as part of the job, we can just assume the user knows best where the layer should go and just use that, skipping inferrence entirely.
