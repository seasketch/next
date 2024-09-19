# Developer notes and TODOs

## Preprocessing

- [] improve scripts to properly assign types to incoming csv data
  - you are going to have to scan the records to account for nulls
- [] convert csv to sqlite db
- [] generate "geostats" for full-resolution file, and any other needed metadata
- [] test upload to d1
- [] build cloudflare worker for performing filtering
  - histograms in particular are needed
- [] develop scheme for summarizing cell properties at lower resolutions
- [] properly encode lower-resolution property values

## Visualization

- [] create function to generate appropriate styles for filtering at low and original resolution
- [] database schema for representing a "h3 filter" sketch class
