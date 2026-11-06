/**
 * S-52 plain-boundaries portrayal for every name in the lookup, not only the
 * classes that happen to occur in one coast. A global chart has to draw a
 * class the first time a cell contains it.
 *
 * The authority is the OpenCPN chart-symbol lookup (IHO S-52 Presentation
 * Library, DAY_BRIGHT colours): area colour (AC), line style (LS), one centred
 * symbol (SY), an area pattern (AP), a complex line (LC), or a conditional
 * procedure (CS). openenc is the picture we compare against. It is not the rule.
 *
 * Conditional procedures choose a mark from sounding, water level, and
 * restriction: DEPARE01, DEPCNT02, LIGHTS05, OBSTRN04, WRECKS02, RESARE02,
 * SOUNDG02, QUAPOS01, SLCONS03, RESTRN01, SYMINS01. Those are approximated
 * (depth colour, sector lights, wreck and rock marks, a magenta limit,
 * soundings, the coastline, a generic new-object mark). Restriction symbols
 * inside a restricted area are not drawn.
 *
 * A lookup name is either given a tile layer or omitted, with the reason.
 * The test fails if any name in the lookup is neither.
 */
import { S52_LOOKUP_CLASSES } from "./s52Lookup.js";

export { S52_LOOKUP_CLASSES };

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
  // Local anomalies and variation. A cell-sized one is dropped at export: the
  // symbol would sit in open water. A small one is a real chart feature.
  MAGVAR: { layer: "land_detail", instruction: "SY(MAGVAR51). Cell-sized areas are not drawn" },
  LOCMAG: { layer: "route", instruction: "SY(LOCMAG51);LS(DASH,1,CHGRD). Cell-sized areas are not drawn" },
  ACHBRT: { layer: "regulated", instruction: "SY(ACHBRT07);LS(DASH,2,CHMGF)" },
  ACHPNT: { layer: "regulated", instruction: "SY(ACHPNT01)" },
  AIRARE: { layer: "land", instruction: "AP(AIRARE02) approximated by a brown fill;LS(SOLD,1,LANDF)" },
  ANNOTA: { layer: "place", instruction: "TX chart note" },
  ARCSLN: { layer: "regulated", instruction: "LC(ARCSLN01) approximated by a magenta dash" },
  ASLXIS: { layer: "regulated", instruction: "LS(DASH,2,CHMGF)" },
  BUIREL: { layer: "land", instruction: "SY religious building" },
  CAUSWY: { layer: "land", instruction: "AC(CHBRN);LS(SOLD,1,CSTLN)" },
  CBLOHD: { layer: "route", instruction: "LS(DASH,4,CHGRD). Clearance text is not drawn" },
  CHKPNT: { layer: "land_detail", instruction: "SY(POSGEN04)" },
  CHNWIR: { layer: "cable", instruction: "LS(DASH,1,CHBLK)" },
  CONVYR: { layer: "structure", instruction: "LS(SOLD,3,CHGRD). Clearance text is not drawn" },
  CRANES: { layer: "land", instruction: "AC(CHBRN);LS(SOLD,1,LANDF)" },
  CTRPNT: { layer: "land_detail", instruction: "SY(POSGEN04)" },
  CTSARE: { layer: "regulated", instruction: "SY(INFARE51);LS(DASH,1,CHMGF)" },
  CURENT: { layer: "route", instruction: "SY(CURENT01,ORIENT)" },
  CUSZNE: { layer: "limit", instruction: "LS(DASH,1,CHGRF)" },
  DAMCON: { layer: "land", instruction: "AC(CHBRN);LS(SOLD,1,LANDF)" },
  DISMAR: { layer: "land_detail", instruction: "SY(DISMAR03)" },
  DOCARE: { layer: "inland_water", instruction: "AC(DEPVS);LS(SOLD,1,CHBLK)" },
  DRYDOC: { layer: "land", instruction: "AC(LANDA);LS(SOLD,1,CSTLN)" },
  DWRTCL: { layer: "route", instruction: "LC(DWRTCL) arrows along the centreline" },
  FERYRT: { layer: "regulated", instruction: "SY(FRYARE51);LS(DASH,2,CHMGD). The complex line is a dash" },
  FORSTC: { layer: "land", instruction: "AC(CHBRN);LS(SOLD,1,LANDF)" },
  FRPARE: { layer: "limit", instruction: "LS(DASH,2,CHGRF)" },
  FSHFAC: { layer: "route", instruction: "AP(FSHHAV02) approximated by one symbol;LS(DASH,1,CHGRD)" },
  FSHGRD: { layer: "limit", instruction: "SY(FSHGRD01);LS(DASH,2,CHGRF)" },
  FSHZNE: { layer: "limit", instruction: "LS(DASH,2,CHGRF)" },
  GATCON: { layer: "land", instruction: "AC(CHBRN);LS(SOLD,2,CSTLN)" },
  GENNAV: { layer: "aid", instruction: "SY(BCNTOW01)" },
  GRIDRN: { layer: "route", instruction: "LS(DASH,1,CHGRD)" },
  HRBARE: { layer: "limit", instruction: "LS(DASH,2,CHGRD)" },
  HRBFAC: { layer: "land", instruction: "SY(CHINFO07)" },
  ICEARE: { layer: "depth_area", instruction: "AC(NODTA);LS(DASH,1,CHGRD). The ice pattern is the no-data tint" },
  ICNARE: { layer: "regulated", instruction: "SY(INFARE51);LS(DASH,1,CHMGF)" },
  ISTZNE: { layer: "separation", instruction: "SY(ITZARE51);LS(DASH,1,TRFCD)" },
  LAKSHR: { layer: "coast", instruction: "LS(SOLD,1,CSTLN)" },
  LOGPON: { layer: "route", instruction: "LS(DASH,1,CHBLK)" },
  MONUMT: { layer: "land_detail", instruction: "SY(MONUMT12)" },
  NATARE: { layer: "regulated", instruction: "No plain instruction. A national area keeps a magenta dash" },
  NEWOBJ: { layer: "regulated", instruction: "SY(NEWOBJ01);LS(DASH,2,CHMGD). SYMINS is not evaluated" },
  OILBAR: { layer: "cable", instruction: "LS(DASH,1,CHBLK)" },
  OSPARE: { layer: "regulated", instruction: "SY(CTYARE51);LS(DASH,2,CHMGD)" },
  PIPARE: { layer: "cable", instruction: "SY(INFARE51);LS(DASH,2,CHMGD)" },
  PIPOHD: { layer: "structure", instruction: "LS(SOLD,3,CHGRD). Clearance text is not drawn" },
  PYLONS: { layer: "land", instruction: "AC(CHBRN);LS(SOLD,2,CSTLN)" },
  RADLNE: { layer: "separation", instruction: "LS(DASH,2,TRFCD)" },
  RADRFL: { layer: "aid", instruction: "SY(RADRFL03)" },
  RADRNG: { layer: "regulated", instruction: "LS(DASH,1,TRFCF)" },
  RADSTA: { layer: "land_detail", instruction: "SY(POSGEN01)" },
  RAILWY: { layer: "land_detail", instruction: "LS(SOLD,2,LANDF)" },
  RAPIDS: { layer: "inland_water", instruction: "AC(CHGRD)" },
  RCRTCL: { layer: "route", instruction: "LC(RCRTCL) arrows along the centreline" },
  RCTLPT: { layer: "separation", instruction: "SY(RTLDEF51)" },
  RDOCAL: { layer: "regulated", instruction: "LS(DASH,1,TRFCD);SY(RCLDEF01)" },
  RESTRC: { layer: "regulated", instruction: "LS(DASH,1,CHMGD)" },
  RETRFL: { layer: "aid", instruction: "SY(RETRFL01)" },
  ROADWY: { layer: "land_detail", instruction: "LS(SOLD,1,LANDF)" },
  RSCSTA: { layer: "land_detail", instruction: "SY(RSCSTA02)" },
  RUNWAY: { layer: "land", instruction: "AC(CHBRN)" },
  SISTAT: { layer: "land_detail", instruction: "SY(SISTAT02)" },
  SISTAW: { layer: "land_detail", instruction: "SY(SISTAT02)" },
  SPLARE: { layer: "regulated", instruction: "SY(CTYARE51);LS(DASH,1,CHMGD)" },
  SPRING: { layer: "land_detail", instruction: "SY(SPRING02)" },
  STSLNE: { layer: "limit", instruction: "LS(DASH,1,CHGRF) territorial-sea baseline" },
  SUBTLN: { layer: "regulated", instruction: "SY(CTYARE51);LS(DASH,1,CHMGD)" },
  SWPARE: { layer: "route", instruction: "LS(DASH,1,CHGRD)" },
  TIDEWY: { layer: "place", instruction: "TX(OBJNAM)" },
  TOWERS: { layer: "land_detail", instruction: "SY(TOWERS03)" },
  TRFLNE: { layer: "regulated", instruction: "LS(DASH,2,CHMGD)" },
  TSSCRS: { layer: "separation", instruction: "SY(TSSCRS51). The junction pattern is the zone dash" },
  TSSRON: { layer: "separation", instruction: "SY(TSSRON51)" },
  TS_FEB: { layer: "route", instruction: "SY(CURDEF01);LS(DASH,1,CHGRD)" },
  TS_PAD: { layer: "route", instruction: "SY(TIDSTR01);LS(DASH,1,CHGRD)" },
  TS_PNH: { layer: "route", instruction: "SY(TIDSTR01);LS(DASH,1,CHGRD)" },
  TS_PRH: { layer: "route", instruction: "SY(TIDSTR01);LS(DASH,1,CHGRD)" },
  TS_TIS: { layer: "route", instruction: "SY(TIDSTR01);LS(DASH,1,CHGRD)" },
  TUNNEL: { layer: "land_detail", instruction: "LS(DASH,1,CHGRD)" },
  TWRTPT: { layer: "separation", instruction: "SY(TWRDEF51);LS(DASH,2,TRFCD)" },
  T_HMON: { layer: "route", instruction: "SY(TIDEHT01);LS(DASH,1,CHGRD)" },
  T_NHMN: { layer: "route", instruction: "SY(TIDEHT01);LS(DASH,1,CHGRD)" },
  T_TIMS: { layer: "route", instruction: "SY(TIDEHT01);LS(DASH,1,CHGRD)" },
  VEGATN: { layer: "land_detail", instruction: "AP approximated by one tree and a dashed limit" },
  WATFAL: { layer: "inland_water", instruction: "LS(SOLD,3,CHGRF)" },
  ZEMCNT: { layer: "coast", instruction: "LS(SOLD,1,CHBLK)" },
};

/** Lookup names that are not features of a chart cell. */
function nonEncReason(name: string): string {
  if (name.startsWith("M_")) return "Chart metadata (coverage, quality, datum). Not a drawn feature.";
  if (name.startsWith("$") || name === "######") return "Lookup fallback for an object with no class.";
  if (name.startsWith("_")) return "OpenCPN internal symbol, not an object class.";
  return "Mariner object. It is not in a chart cell.";
}

for (const name of S52_LOOKUP_CLASSES) {
  if (PORTRAYAL[name]) continue;
  PORTRAYAL[name] = { instruction: "not an ENC feature", omit: nonEncReason(name) };
}

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
  ACHBRT: "anchor",
  ACHPNT: "anchor",
  AIRARE: "airport",
  BUIREL: "landmark-monument",
  CHKPNT: "landmark",
  CONVYR: "landmark-tower",
  CRANES: "landmark-tower",
  CTRPNT: "landmark",
  CTSARE: "info-area",
  CURENT: "current",
  DISMAR: "landmark",
  FERYRT: "ferry",
  FSHFAC: "farm",
  FSHGRD: "farm",
  HRBFAC: "info-area",
  ICNARE: "info-area",
  ISTZNE: "caution",
  LOCMAG: "magnet",
  MAGVAR: "magnet",
  MONUMT: "landmark-monument",
  NEWOBJ: "question",
  OSPARE: "military",
  PIPARE: "info-area",
  PYLONS: "landmark-mast",
  RADRFL: "radio",
  RADSTA: "radio",
  RCTLPT: "traffic-arrow",
  RDOCAL: "radio",
  RETRFL: "landmark",
  RSCSTA: "rescue",
  RUNWAY: "airport",
  SISTAT: "signal",
  SISTAW: "signal",
  SPLARE: "military",
  SPRING: "spring",
  SUBTLN: "military",
  TOWERS: "landmark-tower",
  TSSCRS: "two-way",
  TSSRON: "two-way",
  TS_FEB: "current",
  TS_PAD: "current",
  TS_PNH: "current",
  TS_PRH: "current",
  TS_TIS: "current",
  TWRTPT: "two-way",
  T_HMON: "current",
  T_NHMN: "current",
  T_TIMS: "current",
  VEGATN: "vegetation",
};

/** Variation and local anomalies that fill a cell. About two degrees on a side. */
const CELL_SIZED_META = new Set(["MAGVAR", "LOCMAG"]);
const CELL_SIZED_DEGREES = 2;

function boundsOf(geometry: unknown): [number, number, number, number] | null {
  let bounds: [number, number, number, number] | null = null;
  const visit = (value: unknown) => {
    if (!Array.isArray(value) || value.length === 0) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      const x = value[0];
      const y = value[1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      bounds = bounds
        ? [Math.min(bounds[0], x), Math.min(bounds[1], y), Math.max(bounds[2], x), Math.max(bounds[3], y)]
        : [x, y, x, y];
      return;
    }
    for (const child of value) visit(child);
  };
  if (geometry && typeof geometry === "object") visit((geometry as { coordinates?: unknown }).coordinates);
  return bounds;
}

/**
 * True when a magnetic variation or local anomaly covers a cell rather than a
 * place. Those are dropped so the symbol does not sit in open water. A small
 * anomaly is kept. Anything else, including null, is false.
 */
export function isCellSizedMeta(feature: unknown): boolean {
  if (!feature || typeof feature !== "object") return false;
  const properties = (feature as { properties?: unknown }).properties;
  const objectClass =
    properties && typeof properties === "object" ? (properties as { obj?: unknown }).obj : undefined;
  if (typeof objectClass !== "string" || !CELL_SIZED_META.has(objectClass)) return false;
  const bounds = boundsOf((feature as { geometry?: unknown }).geometry);
  if (!bounds) return true;
  return bounds[2] - bounds[0] > CELL_SIZED_DEGREES || bounds[3] - bounds[1] > CELL_SIZED_DEGREES;
}

export function areaCenterSymbol(objectClass: unknown): string | null {
  if (typeof objectClass !== "string") return null;
  return CENTER_SYMBOL[objectClass] ?? null;
}
