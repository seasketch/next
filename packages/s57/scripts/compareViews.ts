/**
 * Camera positions inside the channel box, each at the zooms where a usage
 * band hands over to the next or a harbour first fills the screen.
 */
export type CompareView = {
  name: string;
  lat: number;
  lng: number;
  zoom: number;
  note?: string;
};

const places: Array<{ name: string; lat: number; lng: number; zooms: number[]; note: string }> = [
  { name: "channel", lat: 34.2, lng: -119.8, zooms: [9, 10], note: "coastal and approach overview" },
  { name: "sb-harbor", lat: 34.405, lng: -119.69, zooms: [11, 12, 13, 14, 15], note: "harbour cell US5CA2HS" },
  { name: "sb-light", lat: 34.395, lng: -119.722, zooms: [13, 14], note: "Santa Barbara Light sector" },
  { name: "goleta", lat: 34.413, lng: -119.83, zooms: [12, 13], note: "approach cell only, landward detail" },
  { name: "platforms", lat: 34.36, lng: -119.6, zooms: [11, 12], note: "oil platforms and pipelines" },
  { name: "ventura", lat: 34.245, lng: -119.265, zooms: [12, 13, 14], note: "Ventura harbour" },
  { name: "ci-harbor", lat: 34.16, lng: -119.225, zooms: [13, 14], note: "Channel Islands Harbor" },
  { name: "anacapa", lat: 34.012, lng: -119.39, zooms: [11, 12, 13], note: "island, cliffs, light" },
  { name: "anacapa-east", lat: 34.0137, lng: -119.3693, zooms: [15], note: "north-shore shelf band, kelp, rock" },
  { name: "scorpion", lat: 34.05, lng: -119.555, zooms: [12, 13], note: "Santa Cruz anchorage" },
  { name: "bechers", lat: 34.0, lng: -120.04, zooms: [11, 12], note: "Santa Rosa, Bechers Bay" },
  { name: "cuyler", lat: 34.05, lng: -120.35, zooms: [11, 12], note: "San Miguel, Cuyler Harbor" },
];

export const COMPARE_VIEWS: CompareView[] = places.flatMap((place) =>
  place.zooms.map((zoom) => ({ name: place.name, lat: place.lat, lng: place.lng, zoom, note: place.note }))
);
