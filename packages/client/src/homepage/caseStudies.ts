export type BBox = [number, number, number, number];

export type CaseStudy = {
  r: string; // region/name
  o: string; // one-line objective/description
  bbox: BBox;
  tilejson?: string;
  sourceLayer?: string;
  geojson?: string;
  layers?: any[];
  slug: string;
  caseStudyPath?: string;
};

export const caseStudies: CaseStudy[] = [
  {
    r: "Azores",
    o: "Designing a North Atlantic MPA network",
    bbox: [-31.5, 35.5, -24.5, 40.5],
    slug: "blueazores",
    geojson:
      "https://d25m7krdtlz75j.cloudfront.net/a9e155e1-a1c7-48b2-a12e-2520ecb5e8d1",
    caseStudyPath: "/case-studies/azores",
  },
  {
    r: "Belize",
    o: "Mapping uses for Belize’s ocean plan",
    bbox: [-90.0, 15.0, -86.0, 19.0],
    tilejson:
      "https://tiles.seasketch.org/projects/belize/public/a78653cc-b6ef-4c69-8165-ea170ca15059.json",
    sourceLayer: "Coastal Planning Regions",
    slug: "belize",
    caseStudyPath: "/case-studies/belize",
  },
  {
    r: "Brazil",
    o: "Nationwide MSP with surveys and forums",
    bbox: [-74.0, -34.0, -28.0, 6.0],
    tilejson:
      "https://tiles.seasketch.org/projects/brasil/public/7129c0f8-8194-444d-8ecf-6a738e056fd3.json",
    sourceLayer: "amazonia_azul_regioes_v2",
    slug: "brasil",
    caseStudyPath: "/case-studies/brazil",
  },
  {
    r: "Maldives",
    o: "Largest Ocean Use Survey of its Time",
    bbox: [71.0, -1.0, 74.5, 8.5],
    tilejson:
      "https://tiles.seasketch.org/projects/maldives/public/6a888989-56cf-4106-8de5-8f061a832e98.json",
    sourceLayer: "ECO_reef",
    slug: "maldives",
    caseStudyPath: "/case-studies/maldives",
  },
  // {
  //   r: "Samoa",
  //   o: "National MSP with extensive community engagement.",
  //   bbox: [-173.9, -14.5, -171.0, -13.0],
  //   geojson:
  //     "https://d25m7krdtlz75j.cloudfront.net/c6ee86e0-d372-4e4d-b363-69aaa67ba59c",
  //   slug: "samoa",
  // },
  {
    r: "Federated States of Micronesia",
    o: "Offline surveys across remote islands",
    bbox: [138.0, 0.0, 164.0, 12.0],
    geojson:
      "https://d25m7krdtlz75j.cloudfront.net/9db2e827-bfa7-44e6-a91c-862da6bc644c",
    slug: "fsm",
    caseStudyPath: "/case-studies/fsm",
  },
  {
    r: "Kiribati",
    o: "Building a national geoportal in 3 days",
    bbox: [170.0, -15.0, 180.0, 7.0],
    geojson:
      "https://uploads.seasketch.org/projects/kiribati/public/d4fea92c-b3c3-4057-ba46-978b34c2e0a4.geojson.json",
    slug: "kiribati",
    caseStudyPath: "/case-studies/kiribati",
  },
  {
    r: "California",
    o: "Adaptive management of California MPAs",
    bbox: [-125.0, 32.0, -114.0, 42.5],
    tilejson:
      "https://tiles.seasketch.org/projects/california/public/39d3e365-f1d5-46eb-9c31-5c4a0f6b6f76.json",
    sourceLayer: "0747d6d8-364e-4d85-83e9-5348e9261baf",
    slug: "california",
    caseStudyPath: "/case-studies/california",
  },
];
