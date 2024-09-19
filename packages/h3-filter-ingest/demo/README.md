# Demonstration Dataset Scripts

During initial project exploration, I didn't have access to a set of annotated
h3 cells to work with, but I did have access to the original 200m grid dataset
and the footprints of each study region. This set of scripts will:

1. Create a set of h3 cells at high resolution (~50m, or resolution 11)
   covering the entire study area
2. Join these cells with data values from the 200m grid dataset, either using
   matching values from overlapping areas or by choosing a random cell where
   no related cells exist in the smaller, 200m region
3. Represent this dataset similarly to what would be expected to be sent by
   the NOVA Southeastern team for the final production dataset. Currently
   that being a CSV file with an id column filled with the h3 cell identifier.

Using this demonstration product I can test the feasibility of a filtering tool
working at this resolution and the process of creating derivative "downsampled"
cells to represent the dataset at differing zoom levels.

## Usage

To begin, `input/` will need to contain the following:

- `200m-grid.fgb` - The 200m grid used in the original MarinePlanner tool
- `footprint-signlepart.geojson` - Polygons representing the areas to be
  represented in the new CRDSS. These need not be exact, but represent roughly
  the same scale in order to test the architecture with a similar number of
  cells.

```bash
# First, sample the 200m cells to h3 resolution 9
npm run demo:200m-cells
# Create high-resolution cells over the entire study area footprint
npm run demo:cells
# Join high-resolution cell list to data from previous MarinePlanner 200m grid
npm run demo:annotate

# After the demo joined-cells.csv file has been created, process it into tiles
# downsample from the max resolution (e.g. 11), to the min resolution, and all
# the steps in between
npm run downsample
# Convert each cells-{resolution}.csv file to fgb, including the hex geometry
npm run fgb
# Create a vector tile package from these spatial files
npm run pmtiles
```
