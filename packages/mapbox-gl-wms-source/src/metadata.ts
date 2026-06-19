import { getNamedLayers } from "./capabilities";
import { WMSLayerMetadataDocument, WMSServiceMetadata } from "./types";
import { defaultFetch, FetchFn } from "./util";

function paragraph(text: string) {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

function heading(text: string, level = 2) {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

export function buildLayerMetadata(
  metadata: WMSServiceMetadata,
  layerName: string
): WMSLayerMetadataDocument {
  const layer = getNamedLayers(metadata.layers).find((l) => l.name === layerName);
  const title =
    layer?.title || layerName || metadata.title || "WMS Layer";
  const content: ({ type: string } & Record<string, unknown>)[] = [
    heading(title, 2),
  ];
  const abstract = layer?.abstract || metadata.abstract;
  if (abstract) {
    content.push(paragraph(abstract));
  }
  if (metadata.accessConstraints) {
    content.push(
      heading("Access Constraints", 3),
      paragraph(metadata.accessConstraints)
    );
  }
  if (metadata.fees) {
    content.push(heading("Fees", 3), paragraph(metadata.fees));
  }
  if (layer?.crs?.length) {
    content.push(
      heading("Supported CRS", 3),
      paragraph(layer.crs.join(", "))
    );
  }
  return {
    title,
    prosemirror: {
      type: "doc",
      content,
    },
  };
}

export async function fetchAndParseMetadataUrl(
  metadataUrl: string,
  options: { fetch?: FetchFn } = {}
): Promise<WMSLayerMetadataDocument | undefined> {
  const fetchFn = options.fetch || defaultFetch;
  try {
    const response = await fetchFn(metadataUrl, {
      headers: { Accept: "application/xml,text/xml,*/*" },
    });
    if (!response.ok) {
      return undefined;
    }
    const xml = await response.text();
    try {
      const { metadataToProseMirror } = await import("@seasketch/metadata-parser");
      const doc = await metadataToProseMirror(xml);
      if (doc) {
        return {
          title: "Layer Metadata",
          prosemirror: doc as unknown as WMSLayerMetadataDocument["prosemirror"],
        };
      }
    } catch {
      // fall through
    }
    return {
      title: "Layer Metadata",
      prosemirror: {
        type: "doc",
        content: [paragraph(xml.slice(0, 500))],
      },
    };
  } catch {
    return undefined;
  }
}
