import { GeoJsonProperties } from "geojson";
/**
 * Type definition for CQL2 queries. A query can be either:
 * - A comparison operator with args: { op: string, args: [{ property: string }, value] }
 * - A logical operator: { and: query[] } | { or: query[] } | { not: query }
 * - A logical operator in op/args format: { op: "and"|"or"|"not", args: query[] }
 */
export type Cql2Query = {
    op?: string;
    args?: (string | number | boolean | {
        property: string;
    } | Cql2Query)[];
    and?: Cql2Query[];
    or?: Cql2Query[];
    not?: Cql2Query;
};
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
export declare function evaluateCql2JSONQuery(query: any, properties: GeoJsonProperties): boolean;
/**
 * Consolidates two CQL2 queries into a single query using OR operator.
 * If either query is undefined, returns the other query.
 * If both queries are present, combines them using OR operator in the op/args format.
 *
 * @param a - First CQL2 query
 * @param b - Second CQL2 query
 * @returns A consolidated CQL2 query that matches either input query
 *
 * @example
 * // Combine two simple queries
 * consolidateCql2Queries(
 *   { op: "=", args: [{ property: "name" }, "test"] },
 *   { op: "=", args: [{ property: "age" }, 25] }
 * )
 * // Returns: { op: "or", args: [
 * //   { op: "=", args: [{ property: "name" }, "test"] },
 * //   { op: "=", args: [{ property: "age" }, 25] }
 * // ]}
 */
export declare function consolidateCql2Queries(a: Cql2Query | undefined, b: Cql2Query | undefined): Cql2Query | undefined;
//# sourceMappingURL=cql2.d.ts.map