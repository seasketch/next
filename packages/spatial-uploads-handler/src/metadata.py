#!/usr/bin/env python3
# Currently unused.
# I started this and realized none of the shapefiles we've uploaded have
# xml metadata files.  I'm not sure if this is something we need to do.
import argparse
from gis_metadata.arcgis_metadata_parser import ArcGISParser
from gis_metadata.fgdc_metadata_parser import FgdcParser
from gis_metadata.iso_metadata_parser import IsoParser
from gis_metadata.metadata_parser import get_metadata_parser


def parse_xml_metadata(path):
    """
    Parses the XML file using the gis-metadata-parser library and returns the parsed metadata.
    """
    with open(path) as metadata:
      return get_metadata_parser(metadata)

def create_markdown_summary(metadata):
    print(metadata.abstract)
    """
    Creates a metadata summary in markdown format based on the parsed metadata.
    """
    summary = ""
    summary += f"#{metadata.title}\n\n"
    summary += f"{metadata.abstract}\n\n"
    summary += f"**Keywords**: {', '.join(metadata.place_keywords)}\n\n"
    summary += f"**Keywords**: {', '.join(metadata.thematic_keywords)}\n\n"

    return summary


def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='XML Metadata Parser')
    parser.add_argument('xml_file', type=str, help='Path to the XML file')
    args = parser.parse_args()

    # Parse the XML file
    metadata = parse_xml_metadata(args.xml_file)

    # Create markdown summary
    summary = create_markdown_summary(metadata)

    # Print the summary
    print(summary)


if __name__ == '__main__':
    main()