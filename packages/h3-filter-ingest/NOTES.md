# Developer notes and TODOs

## Preprocessing

- [x] improve scripts to properly assign types to incoming csv data
  - [x] you are going to have to scan the records to account for nulls
- [x] convert csv to sqlite db
- [x] generate "geostats" for full-resolution file, and any other needed metadata
  - [x] histograms in particular are needed
- [x] test upload to d1
- [] build cloudflare worker for performing filtering
- [] BUG!! - You are accidentally adding the id twice, overwriting region (and others?)
- [] develop scheme for summarizing cell properties at lower resolutions
  - [] booleans
    - 1=All Yes, 0=All No, 2=Mixed, null=All Null
  - [] strings
    - Array[number], numbers reference the index of an item in the unique values field of the attribute's geostats
  - [] numbers
    - col_min, col_max
- [] properly encode lower-resolution property values

## Visualization

- [] create function to generate appropriate styles for filtering at low and original resolution
- [] database schema for representing a "h3 filter" sketch class

# Questions for the Group Call

- Will the filtering tool be targeted at just coral reef restoration sites, or will it be used as-is for other use cases? How general purpose should it be?
