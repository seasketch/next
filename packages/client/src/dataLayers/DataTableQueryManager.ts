import { DataTableQuerySettings } from "./dataTableQueryApi";

export class DataTableQueryManager {
  private mapAccessToken: string | null = null;

  constructor(mapAccessToken: string | null) {
    this.mapAccessToken = mapAccessToken;
  }

  setMapAccessToken(mapAccessToken: string | null) {
    this.mapAccessToken = mapAccessToken;
  }

  /**
   * Key that can be used to cache the result of a data table query.
   *
   * @param url - The URL of the data table query.
   * @param query - The query settings for the data table query.
   * @returns The key that can be used to cache the result of a data table query.
   */
  private getQueryKey(url: string, query: DataTableQuerySettings) {
    return JSON.stringify({
      url,
      query,
    });
  }
}
