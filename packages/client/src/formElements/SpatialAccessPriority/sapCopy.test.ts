import { SketchGeometryType } from "../../generated/graphql";
import {
  adaptFeatureNameElement,
  adaptSketchFormElement,
  AREA_NAME_PREFIX,
  componentSettingsForGeometry,
  geometryTypeLocked,
  instructionReplacedStock,
  POINT_NAME_PREFIX,
  polygonInstruction,
  polygonQuestionMarkdown,
  proseText,
  questionBodyForGeometry,
  resolveSapInstruction,
} from "./sapCopy";
import { questionBodyFromMarkdown } from "../fromMarkdown";

describe("proseText", () => {
  it("returns empty text for null, undefined, and non-objects", () => {
    expect(proseText(null)).toBe("");
    expect(proseText(undefined)).toBe("");
    expect(proseText("Area Name")).toBe("");
    expect(proseText(4)).toBe("");
  });

  it("joins text nodes from a document", () => {
    expect(proseText(polygonInstruction("question"))).toBe(
      proseText(questionBodyFromMarkdown(polygonQuestionMarkdown))
    );
    expect(proseText(polygonInstruction("question"))).toContain(
      "draw and prioritize valued areas"
    );
  });
});

describe("resolveSapInstruction", () => {
  const polygonQuestion = polygonInstruction("question");
  const custom = questionBodyFromMarkdown("# Where do you fish?");

  it("keeps stored polygon copy for polygon questions", () => {
    expect(
      resolveSapInstruction(
        "question",
        polygonQuestion,
        SketchGeometryType.Polygon
      )
    ).toBe(polygonQuestion);
  });

  it("uses the polygon default when a polygon question has no body", () => {
    expect(
      proseText(
        resolveSapInstruction("question", null, SketchGeometryType.Polygon)
      )
    ).toContain("valued areas");
  });

  it("substitutes point copy when the stored text is still the polygon default", () => {
    const resolved = resolveSapInstruction(
      "question",
      polygonQuestion,
      SketchGeometryType.Point
    );
    expect(proseText(resolved)).toContain("place a point");
    expect(proseText(resolved)).not.toContain("valued areas");
  });

  it("keeps an edited prompt when the geometry is a point", () => {
    expect(
      resolveSapInstruction("begin", custom, SketchGeometryType.Point)
    ).toBe(custom);
  });

  it("restores polygon copy if the stored text is the point default", () => {
    const pointQuestion = resolveSapInstruction(
      "question",
      polygonQuestion,
      SketchGeometryType.Point
    );
    const restored = resolveSapInstruction(
      "question",
      pointQuestion,
      SketchGeometryType.Polygon
    );
    expect(proseText(restored)).toContain("valued areas");
  });

  it("treats a missing geometry type as polygon", () => {
    expect(resolveSapInstruction("nav", polygonInstruction("nav"), null)).toBe(
      polygonInstruction("nav")
    );
  });
});

describe("instructionReplacedStock", () => {
  it("flags a polygon default shown on a point question", () => {
    expect(
      instructionReplacedStock(
        "list",
        polygonInstruction("list"),
        SketchGeometryType.Point
      )
    ).toBe(true);
  });

  it("keeps translations when the polygon question still shows its stored text", () => {
    expect(
      instructionReplacedStock(
        "list",
        polygonInstruction("list"),
        SketchGeometryType.Polygon
      )
    ).toBe(false);
  });
});

describe("componentSettingsForGeometry", () => {
  it("rewrites stock bodies when switching to points and leaves custom text", () => {
    const customList = questionBodyFromMarkdown("Keep my list text");
    const { settings, changed } = componentSettingsForGeometry(
      {
        beginBody: polygonInstruction("begin"),
        listShapesBody: customList,
        navBody: polygonInstruction("nav"),
        sectorOptions: [{ label: "Diving", value: "diving" }],
      },
      SketchGeometryType.Point
    );
    expect(changed).toBe(true);
    expect(proseText(settings.beginBody)).toContain("place a point");
    expect(settings.listShapesBody).toBe(customList);
    expect(proseText(settings.navBody)).toContain("prioritize points");
    expect(settings.sectorOptions).toEqual([
      { label: "Diving", value: "diving" },
    ]);
  });

  it("does not rewrite polygon stock while the question stays a polygon", () => {
    const stored = {
      beginBody: polygonInstruction("begin"),
      listShapesBody: polygonInstruction("list"),
      navBody: polygonInstruction("nav"),
    };
    const { changed } = componentSettingsForGeometry(
      stored,
      SketchGeometryType.Polygon
    );
    expect(changed).toBe(false);
  });
});

describe("questionBodyForGeometry", () => {
  it("returns null when the stored question already matches", () => {
    expect(
      questionBodyForGeometry(
        polygonInstruction("question"),
        SketchGeometryType.Polygon
      )
    ).toBeNull();
  });

  it("returns point copy when the question is still the polygon default", () => {
    const next = questionBodyForGeometry(
      polygonInstruction("question"),
      SketchGeometryType.Point
    );
    expect(proseText(next)).toContain("place a point");
  });
});

describe("adaptFeatureNameElement", () => {
  const areaName = {
    typeId: "FeatureName",
    body: questionBodyFromMarkdown("# Area Name"),
    componentSettings: { generatedNamePrefix: AREA_NAME_PREFIX },
  };

  it("renames the stock area field when the question collects points", () => {
    const adapted = adaptFeatureNameElement(areaName, SketchGeometryType.Point);
    expect(adapted.componentSettings.generatedNamePrefix).toBe(
      POINT_NAME_PREFIX
    );
    expect(proseText(adapted.body)).toBe("Point Name");
  });

  it("leaves a customized name field alone", () => {
    const custom = {
      ...areaName,
      componentSettings: { generatedNamePrefix: "Ground" },
    };
    expect(
      adaptFeatureNameElement(custom, SketchGeometryType.Point)
    ).toBe(custom);
  });

  it("does not change other child fields", () => {
    const range = {
      typeId: "SAPRange",
      body: null,
      componentSettings: { min: 0 },
    };
    expect(adaptFeatureNameElement(range, SketchGeometryType.Point)).toBe(
      range
    );
  });

  it("restores the area name when switching back and the field is still stock", () => {
    const pointName = adaptFeatureNameElement(
      areaName,
      SketchGeometryType.Point
    );
    const restored = adaptFeatureNameElement(
      pointName,
      SketchGeometryType.Polygon
    );
    expect(restored.componentSettings.generatedNamePrefix).toBe(
      AREA_NAME_PREFIX
    );
    expect(proseText(restored.body)).toBe("Area Name");
  });
});

describe("adaptSketchFormElement", () => {
  it("rewrites the stock priority prompt for points and drops its translation", () => {
    const range = {
      typeId: "SAPRange",
      body: questionBodyFromMarkdown("# How important is this area?"),
      componentSettings: { min: 0 },
      alternateLanguageSettings: {
        es: { body: questionBodyFromMarkdown("# ¿Qué tan importante es esta área?") },
      },
    };
    const adapted = adaptSketchFormElement(range, SketchGeometryType.Point);
    expect(proseText(adapted.body)).toBe("How important is this location?");
    expect(adapted.alternateLanguageSettings.es.body).toBeUndefined();
  });

  it("leaves a customized priority prompt alone", () => {
    const range = {
      typeId: "SAPRange",
      body: questionBodyFromMarkdown("# How much does this matter?"),
      componentSettings: { min: 0 },
      alternateLanguageSettings: null,
    };
    expect(adaptSketchFormElement(range, SketchGeometryType.Point)).toBe(range);
  });

  it("restores the stock area prompt when switching back to polygons", () => {
    const point = adaptSketchFormElement(
      {
        typeId: "SAPRange",
        body: questionBodyFromMarkdown("# How important is this area?"),
        componentSettings: { min: 0 },
      },
      SketchGeometryType.Point
    );
    const restored = adaptSketchFormElement(point, SketchGeometryType.Polygon);
    expect(proseText(restored.body)).toBe("How important is this area?");
  });
});

describe("geometryTypeLocked", () => {
  it("locks when any sketch has been saved", () => {
    expect(geometryTypeLocked(1)).toBe(true);
    expect(geometryTypeLocked("2")).toBe(true);
  });

  it("stays unlocked for zero, empty, and missing counts", () => {
    expect(geometryTypeLocked(0)).toBe(false);
    expect(geometryTypeLocked("0")).toBe(false);
    expect(geometryTypeLocked(null)).toBe(false);
    expect(geometryTypeLocked(undefined)).toBe(false);
    expect(geometryTypeLocked("")).toBe(false);
    expect(geometryTypeLocked({})).toBe(false);
  });
});
