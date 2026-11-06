/**
 * S-52 plain-boundaries portrayal for every class these charts contain.
 *
 * The authority is the OpenCPN chart-symbol lookup (IHO S-52 Presentation
 * Library, DAY_BRIGHT colours): area colour (AC), line style (LS), one centred
 * symbol (SY), an area pattern (AP), a complex line (LC), or a conditional
 * procedure (CS). openenc is the picture we compare against. It is not the rule.
 *
 * Conditional procedures choose a mark from sounding, water level, and
 * restriction: DEPARE01, DEPCNT02, LIGHTS05, OBSTRN04, WRECKS02, RESARE02,
 * SOUNDG02, QUAPOS01, SLCONS03, RESTRN01. Those are approximated here (depth
 * colour, sector lights, wreck and rock marks, a magenta limit, soundings, the
 * coastline). The restriction symbols inside a restricted area are not drawn.
 *
 * A class is either given a tile layer or omitted, with the reason. The test
 * fails if a class in the Channel cells is neither.
 */

export type Portrayal = {
  /** The S-52 instruction this follows. A CS() entry is the approximation above. */
  instruction: string;
  layer?: string;
  /** Why a class the lookup mentions is not drawn. */
  omit?: string;
};

export const PORTRAYAL: Record<string, Portrayal> = {
  DEPARE: { layer: "depth_area", instruction: "CS(DEPARE01) colour by depth" },
  DRGARE: { layer: "depth_area", instruction: "CS(DEPARE01) plus a dashed black limit" },
  UNSARE: { layer: "depth_area", instruction: "AC(NODTA)" },
  LNDARE: { layer: "land", instruction: "AC(LANDA) and the name" },
  BUAARE: { layer: "land", instruction: "AC(CHBRN) and the name" },
  FLODOC: { layer: "land", instruction: "AC(CHBRN);LS(SOLD,2,CSTLN)" },
  HULKES: { layer: "land", instruction: "AC(CHBRN);LS(SOLD,2,CSTLN)" },
  PONTON: { layer: "land", instruction: "AC(CHBRN);LS(SOLD,2,CSTLN)" },
  SMCFAC: { layer: "land", instruction: "AC(CHBRN);SY(SMCFAC02);LS(SOLD,1,LANDF)" },
  LNDELV: { layer: "land_detail", instruction: "LS(SOLD,1,LANDF) and the elevation" },
  LNDMRK: { layer: "land_detail", instruction: "SY by CATLMK" },
  BUISGL: { layer: "land_detail", instruction: "AC(CHBRN);LS(SOLD,1,LANDF)" },
  SILTNK: { layer: "land_detail", instruction: "AC(CHBRN);LS(SOLD,1,LANDF)" },
  CGUSTA: { layer: "land_detail", instruction: "SY(CGUSTA02)" },
  DYKCON: { layer: "land_detail", instruction: "LS(SOLD,3,LANDF)" },
  FNCLNE: { layer: "land_detail", instruction: "LS(SOLD,1,LANDF)" },
  SLOGRD: { layer: "land_detail", instruction: "SY(HILTOP01);LS(SOLD,1,LANDF)" },
  SLOTOP: { layer: "land_detail", instruction: "SY(HILTOP01);LS(SOLD,1,LANDF)" },
  PRDARE: { layer: "land_detail", instruction: "LS(DASH,1,LANDF)" },
  RDOSTA: { layer: "land_detail", instruction: "SY(RDOSTA02)" },
  SBDARE: { layer: "seabed", instruction: "nature-of-surface letter; rock areas are not a pattern" },
  WEDKLP: { layer: "seabed", instruction: "SY(WEDKLP03);LS(DASH,1,CHGRF)" },
  SNDWAV: { layer: "seabed", instruction: "AP(SNDWAV01);LS(DASH,2,CHGRD)" },
  WATTUR: { layer: "seabed", instruction: "SY(WATTUR02);LS(DASH,1,CHGRD)" },
  LAKARE: { layer: "inland_water", instruction: "AC(DEPVS);LS(SOLD,1,CHBLK)" },
  LOKBSN: { layer: "inland_water", instruction: "AC(DEPVS);LS(SOLD,1,CHBLK)" },
  RIVERS: { layer: "inland_water", instruction: "AC(DEPVS);LS(SOLD,1,CHBLK)" },
  CANALS: { layer: "inland_water", instruction: "AC(DEPVS);LS(SOLD,1,CHBLK)" },
  COALNE: { layer: "coast", instruction: "CS(QUAPOS01) coastline" },
  SLCONS: { layer: "coast", instruction: "CS(SLCONS03) shoreline construction" },
  DEPCNT: { layer: "depth_contour", instruction: "CS(DEPCNT02)" },
  SOUNDG: { layer: "sounding", instruction: "CS(SOUNDG02)" },
  LIGHTS: { layer: "aid", instruction: "CS(LIGHTS05) light and sectors" },
  LITFLT: { layer: "aid", instruction: "SY(LITFLT01)" },
  LITVES: { layer: "aid", instruction: "SY(LITVES01)" },
  BOYSPP: { layer: "aid", instruction: "SY(BOYGEN03) special mark" },
  BOYCAR: { layer: "aid", instruction: "SY(BOYGEN03) cardinal" },
  BOYISD: { layer: "aid", instruction: "SY(BOYGEN03) isolated danger" },
  BOYLAT: { layer: "aid", instruction: "lateral shape and colour" },
  BOYSAW: { layer: "aid", instruction: "SY(BOYGEN03) safe water" },
  BOYINB: { layer: "aid", instruction: "SY(BOYINB01)" },
  BCNSPP: { layer: "aid", instruction: "SY(BCNGEN01)" },
  BCNCAR: { layer: "aid", instruction: "SY(BCNGEN03)" },
  BCNISD: { layer: "aid", instruction: "SY(BCNGEN03)" },
  BCNLAT: { layer: "aid", instruction: "lateral beacon" },
  BCNSAW: { layer: "aid", instruction: "SY(BCNGEN03)" },
  DAYMAR: { layer: "aid", instruction: "SY(DAYSQR21)" },
  TOPMAR: { layer: "aid", instruction: "SY by TOPSHP" },
  FOGSIG: { layer: "aid", instruction: "SY(FOGSIG01)" },
  RTPBCN: { layer: "aid", instruction: "SY(RTPBCN02)" },
  OBSTRN: { layer: "hazard", instruction: "CS(OBSTRN04)" },
  WRECKS: { layer: "hazard", instruction: "CS(WRECKS02)" },
  UWTROC: { layer: "hazard", instruction: "CS(OBSTRN04)" },
  PILPNT: { layer: "pile", instruction: "SY(PILPNT02)" },
  OFSPLF: { layer: "platform", instruction: "SY(OFSPLF01);LS(SOLD,4,CSTLN)" },
  MORFAC: { layer: "mooring", instruction: "SY(MORFAC03)" },
  BERTHS: { layer: "mooring", instruction: "SY(BRTHNO01) and the name" },
  CBLSUB: { layer: "cable", instruction: "LC(CBLSUB06) wavy cable" },
  CBLARE: { layer: "cable", instruction: "centred cable symbol and a magenta dash" },
  PIPSOL: { layer: "cable", instruction: "LC(PIPSOL05) pipeline" },
  TSSLPT: { layer: "separation", instruction: "SY(TSSLPT51,ORIENT) open arrows; the lane is not filled" },
  TSSBND: { layer: "separation", instruction: "LS(DASH,2,TRFCD)" },
  TSELNE: { layer: "separation", instruction: "LS(SOLD,6,TRFCF) thick solid line" },
  DWRTPT: { layer: "separation", instruction: "SY(DWRTPT51);LS(DASH,2,TRFCD)" },
  TSEZNE: { layer: "separation", instruction: "AC(TRFCF,3) zone fill, 75% transparent" },
  BRIDGE: { layer: "structure", instruction: "LS(SOLD,4,CHGRD) and clearance" },
  SEAARE: { layer: "place", instruction: "TX(OBJNAM)" },
  LNDRGN: { layer: "place", instruction: "TX(OBJNAM)" },
  RESARE: { layer: "regulated", instruction: "CS(RESARE02) magenta dash; restriction symbols not drawn" },
  ACHARE: { layer: "regulated", instruction: "SY(ACHARE51) anchor;LS(DASH,2,CHMGF)" },
  CTNARE: { layer: "regulated", instruction: "SY(CTNARE51);LS(DASH,2,TRFCD)" },
  MIPARE: { layer: "regulated", instruction: "SY(CTYARE51);LS(DASH,2,CHMGD)" },
  DMPGRD: { layer: "regulated", instruction: "SY(INFARE51);LS(DASH,1,CHMGD)" },
  PRCARE: { layer: "regulated", instruction: "SY(PRCARE51);LS(DASH,2,TRFCD)" },
  MARCUL: { layer: "regulated", instruction: "AP(MARCUL02) approximated by one symbol;LS(DASH,1,CHGRD)" },
  PILBOP: { layer: "regulated", instruction: "SY(PILBOP02);LS(DASH,2,TRFCF)" },
  FAIRWY: { layer: "route", instruction: "LS(DASH,1,CHGRD). One-way fairway arrow FAIRWY51 is not placed" },
  RECTRC: { layer: "route", instruction: "LC(RECTRC) arrows along the track;LS(DASH,1,CHGRD)" },
  NAVLNE: { layer: "route", instruction: "LS(DASH,1,CHGRD)" },
  ADMARE: { layer: "limit", instruction: "LS(DASH,2,CHGRF) administrative limit" },
  CONZNE: { layer: "limit", instruction: "LS(DASH,2,CHGRF)" },
  COSARE: { layer: "limit", instruction: "LS(DASH,2,CHGRF)" },
  EXEZNE: { layer: "limit", instruction: "LS(DASH,2,CHGRF)" },
  TESARE: { layer: "limit", instruction: "LS(DASH,2,CHGRF);CS(RESTRN01) symbols not drawn" },
  MAGVAR: {
    instruction: "SY(MAGVAR51)",
    omit: "The area covers the cell. S-52 drops one variation symbol in it; a paper chart puts the variation in the compass rose. A mark at every cell centroid would sit in open water.",
  },
  LOCMAG: {
    instruction: "SY(LOCMAG51);LS(DASH,2,CHMGD)",
    omit: "The only anomaly in these cells covers the overview cell. Drawn once a local, not cell-filling, anomaly is in the data.",
  },
};

/**
 * Object classes present in the 34 Channel cells. The portrayal test requires
 * every one of these to be drawn or explicitly omitted.
 */
export const CHANNEL_CLASSES = [
  "ACHARE",
  "ADMARE",
  "BCNLAT",
  "BCNSPP",
  "BERTHS",
  "BOYLAT",
  "BOYSAW",
  "BOYSPP",
  "BRIDGE",
  "BUAARE",
  "BUISGL",
  "CBLARE",
  "CBLSUB",
  "CGUSTA",
  "COALNE",
  "CONZNE",
  "COSARE",
  "CTNARE",
  "DAYMAR",
  "DEPARE",
  "DEPCNT",
  "DMPGRD",
  "DRGARE",
  "DYKCON",
  "EXEZNE",
  "FAIRWY",
  "FNCLNE",
  "FOGSIG",
  "LAKARE",
  "LIGHTS",
  "LNDELV",
  "LNDARE",
  "LNDMRK",
  "LNDRGN",
  "LOCMAG",
  "MAGVAR",
  "MARCUL",
  "MIPARE",
  "MORFAC",
  "NAVLNE",
  "OBSTRN",
  "OFSPLF",
  "PILBOP",
  "PILPNT",
  "PIPSOL",
  "PONTON",
  "PRCARE",
  "PRDARE",
  "RDOSTA",
  "RECTRC",
  "RESARE",
  "RIVERS",
  "RTPBCN",
  "SBDARE",
  "SEAARE",
  "SILTNK",
  "SLCONS",
  "SLOGRD",
  "SLOTOP",
  "SMCFAC",
  "SNDWAV",
  "SOUNDG",
  "TESARE",
  "TOPMAR",
  "TSEZNE",
  "TSSBND",
  "TSSLPT",
  "UWTROC",
  "WATTUR",
  "WEDKLP",
  "WRECKS",
];

/**
 * Sprite drawn once inside the area: the S-52 SY() for that class.
 * Anchorage, pilots, and landmarks have their own layers, so they are absent.
 * Returns null for a class with no centred symbol, and for any non-string.
 */
const CENTER_SYMBOL: Record<string, string> = {
  CTNARE: "caution",
  MIPARE: "military",
  DMPGRD: "info-area",
  PRCARE: "precaution",
  MARCUL: "farm",
  WEDKLP: "kelp",
  WATTUR: "turbulence",
  CBLARE: "cable-area",
  RDOSTA: "radio",
  SMCFAC: "facility",
  DWRTPT: "two-way",
};

export function areaCenterSymbol(objectClass: unknown): string | null {
  if (typeof objectClass !== "string") return null;
  return CENTER_SYMBOL[objectClass] ?? null;
}
