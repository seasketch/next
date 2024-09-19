import * as h3 from "h3-js";
import * as gdal from "gdal-async";
import * as Papa from "papaparse";
import { createReadStream, readdirSync, readFileSync } from "node:fs";
// @ts-ignore
import cliProgress from 'cli-progress';

// Function to count the total number of rows by counting newlines
function countRows(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => {
      for (let i = 0; i < chunk.length; ++i) {
        if (chunk[i] === 10) { // 10 is the ASCII code for newline (\n)
          lineCount++;
        }
      }
    });

    stream.on('end', () => resolve(lineCount));
    stream.on('error', reject);
  });
}

function csvToFGB(filePath: string, outputPath: string) {
  // First, create a new fgb to write to
  const driver = gdal.drivers.get('FlatGeobuf');
  const ds = driver.create(outputPath);

  const layer = ds.layers.create('cells', gdal.SpatialReference.fromEPSG(4326), gdal.wkbPolygon);
  layer.fields.add(new gdal.FieldDefn('id', gdal.OFTString));

  // Create a progress bar
  const progressBar = new cliProgress.SingleBar({
    format: `${filePath.split("/").slice(-1)} | {bar} | {percentage}% | {eta}s || {value}/{total} cells processed`,
  }, cliProgress.Presets.shades_classic);

  return new Promise((resolve, reject) => {
    // Count the number of rows in the CSV file
    countRows(filePath).then(totalRows => {
      // Start the progress bar with the total number of rows
      progressBar.start(totalRows, 0);

      // Create a read stream from the input csv file
      const stream = createReadStream(filePath);
      let i = 0;

      Papa.parse<{ id: string } & any>(stream, {
        header: true,
        step: (row: any) => {
          if (i === 0) {
            // add field definitions
            for (const key in row.data) {
              if (key !== 'id' && key !== "__parsed_extra") {
                let type: string = gdal.OFTString;
                switch (typeof row.data[key]) {
                  case 'number':
                    type = gdal.OFTReal;
                    break;
                  case 'boolean':
                    type = gdal.OFTInteger;
                    break;
                }
                console.log(`Adding field ${key} with type ${type}`);
                layer.fields.add(new gdal.FieldDefn(key, type));
              }
            }
          }

          i++;
          if (i % 5000 === 0) {
            // Update the progress bar after every 1000 rows processed
            progressBar.update(i);
          }

          const id = row.data.id.toString();
          const polygon = h3.cellsToMultiPolygon([id], true)[0];

          const feature = new gdal.Feature(layer);
          feature.setGeometry(gdal.Geometry.fromGeoJson({
            type: "Polygon",
            coordinates: polygon
          }));
          feature.fields.set('id', id);

          layer.fields.forEach(field => {
            feature.fields.set(field.name, row.data[field.name]);
          });
          layer.features.add(feature);
        },
        complete: () => {
          // Stop the progress bar when done
          progressBar.update(totalRows);  // Set it to 100% completion
          progressBar.stop();
          console.log(`Wrote ${i.toLocaleString()} cells to ${outputPath}`);
          resolve(outputPath);
        },
        error: (err) => {
          reject(err);
        }
      });

    }).catch(err => {
      reject(new Error(`Error counting rows: ${err.message}`));
    });
  });
}

(async () => {
  // Search in ./output for files in the form of cells-*.csv, and call csvToFGB on each
  const files = readdirSync('./output')
    .filter((file) => file.toString().startsWith('cells-') && file.toString().endsWith('.csv'))
    .sort((a, b) => {
      const aNumber = parseInt(a.match(/cells-(\d+)\.csv/)?.[1] || '0');
      const bNumber = parseInt(b.match(/cells-(\d+)\.csv/)?.[1] || '0');
      return bNumber - aNumber;
    });

  for (const file of files) {
    await csvToFGB(`./output/${file}`, `./output/${file.toString().replace('.csv', '.fgb')}`);
  }
})();
