/**
 * Evaluates a JSON-encoded OGC CQL2 query against a set of properties.
 *
 * This function implements a subset of the OGC CQL2 specification, supporting:
 * - Comparison operators: =, !=, <, <=, >, >=, like, ilike, in
 * - Logical operators: and, or, not
 *
 * @param query - The CQL2 query to evaluate. Must be a valid object containing either:
 *   - A comparison operator with args: { op: string, args: [{ property: string }, value] }
 *   - A logical operator: { and: query[] } | { or: query[] } | { not: query }
 * @param properties - An object containing the property values to evaluate against
 * @returns boolean - true if the query matches the properties, false otherwise
 * @throws Error if:
 *   - query is null or undefined
 *   - query is not an object
 *   - query uses an unsupported operator
 *   - query arguments are invalid (missing property, wrong number of args)
 *
 * @example
 * // Simple equality
 * evaluateCql2JSONQuery(
 *   { op: '=', args: [{ property: 'name' }, 'test'] },
 *   { name: 'test' }
 * ) // returns true
 *
 * @example
 * // Logical combination
 * evaluateCql2JSONQuery(
 *   {
 *     and: [
 *       { op: '=', args: [{ property: 'age' }, 25] },
 *       { op: '!=', args: [{ property: 'name' }, 'admin'] }
 *     ]
 *   },
 *   { age: 25, name: 'user' }
 * ) // returns true
 */
export function evaluateCql2JSONQuery(
  query: any,
  properties: { [key: string]: any }
): boolean {
  if (query === null || query === undefined) {
    throw new Error("Query cannot be null or undefined");
  }
  if (typeof query !== "object") {
    throw new Error(`Invalid query format: ${query}`);
  }

  // Handle logical operators
  if (query.and && Array.isArray(query.and)) {
    return query.and.every((sub: any) =>
      evaluateCql2JSONQuery(sub, properties)
    );
  }
  if (query.or && Array.isArray(query.or)) {
    return query.or.some((sub: any) => evaluateCql2JSONQuery(sub, properties));
  }
  if (query.not) {
    return !evaluateCql2JSONQuery(query.not, properties);
  }

  // Handle comparison operators
  const ops = ["=", "!=", "<", "<=", ">", ">=", "like", "ilike", "in"];
  if (!ops.includes(query["op"])) {
    throw new Error(`Unsupported operator: ${query["op"]}`);
  }
  const op = query["op"];
  const args = query["args"];
  if (!Array.isArray(args) || args.length !== 2) {
    throw new Error(
      `Invalid arguments for operator ${op}: ${JSON.stringify(args)}`
    );
  }
  if (!args[0] || !args[0].property) {
    throw new Error(`Missing property in arguments: ${JSON.stringify(args)}`);
  }
  const property = args[0].property;
  const propValue = properties[property];
  const value = args[1];

  switch (op) {
    case "=":
      return propValue === value;
    case "!=":
      return propValue !== value;
    case "<":
      return propValue < value;
    case "<=":
      return propValue <= value;
    case ">":
      return propValue > value;
    case ">=":
      return propValue >= value;
    case "like":
      if (typeof propValue === "string" && typeof value === "string") {
        // Convert SQL LIKE pattern to RegExp
        const regex = new RegExp(
          "^" + value.replace(/%/g, ".*").replace(/_/g, ".") + "$"
        );
        return regex.test(propValue);
      }
      return false;
    case "ilike":
      if (typeof propValue === "string" && typeof value === "string") {
        const regex = new RegExp(
          "^" + value.replace(/%/g, ".*").replace(/_/g, ".") + "$",
          "i"
        );
        return regex.test(propValue);
      }
      return false;
    case "in":
      if (Array.isArray(value)) {
        return value.includes(propValue);
      }
      return false;
  }

  // Unknown or unsupported query
  return false;
}
