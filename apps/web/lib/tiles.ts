export type TileCoord = {
  z: number;
  x: number;
  y: number;
};

export type TileBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

function lon2tileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}

function lat2tileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, z)
  );
}

function tileX2lon(x: number, z: number): number {
  return (x / Math.pow(2, z)) * 360 - 180;
}

function tileY2lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function tileKey(tile: TileCoord): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

export function tileBounds(tile: TileCoord): TileBounds {
  const west = tileX2lon(tile.x, tile.z);
  const east = tileX2lon(tile.x + 1, tile.z);
  const north = tileY2lat(tile.y, tile.z);
  const south = tileY2lat(tile.y + 1, tile.z);

  return { west, south, east, north };
}

export function tileBboxString(tile: TileCoord): string {
  const b = tileBounds(tile);
  return `${b.west},${b.south},${b.east},${b.north}`;
}

export function getVisibleTiles(
  west: number,
  south: number,
  east: number,
  north: number,
  z: number
): TileCoord[] {
  const minX = lon2tileX(west, z);
  const maxX = lon2tileX(east, z);
  const minY = lat2tileY(north, z);
  const maxY = lat2tileY(south, z);

  const tiles: TileCoord[] = [];

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      tiles.push({ z, x, y });
    }
  }

  return tiles;
}

/**
 * Use a modest, stable query zoom for caching.
 * We do not want tile churn at every display zoom.
 */
export function getQueryTileZoom(mapZoom: number): number {
  if (mapZoom < 6) return 5;
  if (mapZoom < 8) return 6;
  if (mapZoom < 10) return 7;
  return 8;
}