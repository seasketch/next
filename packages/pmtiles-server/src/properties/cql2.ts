export function evaluateCql2JSONQuery(
  query: unknown,
  properties: Record<string, unknown>,
): boolean {
  if (!query || typeof query !== "object") {
    throw new Error("Invalid CQL2 query");
  }
  const node = query as Record<string, unknown>;
  if (Array.isArray(node.and)) {
    return node.and.every((part) => evaluateCql2JSONQuery(part, properties));
  }
  if (Array.isArray(node.or)) {
    return node.or.some((part) => evaluateCql2JSONQuery(part, properties));
  }
  if (node.not) return !evaluateCql2JSONQuery(node.not, properties);

  const op = node.op;
  const args = node.args;
  if (
    typeof op !== "string" ||
    !["=", "!=", "<", "<=", ">", ">=", "like", "ilike", "in"].includes(op) ||
    !Array.isArray(args) ||
    args.length !== 2
  ) {
    throw new Error("Invalid or unsupported CQL2 expression");
  }
  const propertyNode = args[0] as { property?: unknown } | null;
  if (!propertyNode || typeof propertyNode.property !== "string") {
    throw new Error("CQL2 property argument is required");
  }
  const actual = properties[propertyNode.property] as any;
  const expected = args[1] as any;
  switch (op) {
    case "=": return actual === expected;
    case "!=": return actual !== expected;
    case "<": return actual < expected;
    case "<=": return actual <= expected;
    case ">": return actual > expected;
    case ">=": return actual >= expected;
    case "in": return Array.isArray(expected) && expected.includes(actual);
    case "like":
    case "ilike": {
      if (typeof actual !== "string" || typeof expected !== "string") return false;
      const escaped = expected
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".");
      return new RegExp(`^${escaped}$`, op === "ilike" ? "i" : "").test(actual);
    }
    default: return false;
  }
}
