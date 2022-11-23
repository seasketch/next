declare module "@mapbox/mbtiles" {
  class MBTiles {
    constructor(path: string, callback: (err: Error, mb: MBtiles) => void);
    getInfo(callback: (err: Error, info: any) => void): void;
  }
  export default MBTiles;
}
