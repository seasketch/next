import { QueryResult } from "pg";

export interface DBClient {
  query: (sql: string, values?: any[]) => Promise<QueryResult>;
}
