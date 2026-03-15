const LOCAL_API_BASE_URL = "http://localhost:8000";
const DEFAULT_TERRAIN_TILES_URL =
  "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";
const DEFAULT_TERRAIN_ENCODING = "terrarium";
const DEFAULT_TERRAIN_TILE_SIZE = 256;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function validateUrl(name: string, value: string): string {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("unsupported protocol");
    }
    return value;
  } catch {
    throw new Error(`${name} must be a full http(s) URL. Received: ${value}`);
  }
}

function validateTerrainEncoding(value: string): "terrarium" | "mapbox" {
  if (value === "terrarium" || value === "mapbox") {
    return value;
  }

  throw new Error(
    `NEXT_PUBLIC_TERRAIN_ENCODING must be "terrarium" or "mapbox". Received: ${value}`
  );
}

function validateTerrainTileSize(value: string): number {
  const tileSize = Number(value);
  if (Number.isFinite(tileSize) && tileSize > 0) {
    return tileSize;
  }

  throw new Error(
    `NEXT_PUBLIC_TERRAIN_TILE_SIZE must be a positive number. Received: ${value}`
  );
}

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configured) {
    return validateUrl("NEXT_PUBLIC_API_BASE_URL", configured);
  }

  if (isProduction()) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is required in production.");
  }

  return LOCAL_API_BASE_URL;
}

export function getTerrainConfig() {
  const tilesUrl =
    process.env.NEXT_PUBLIC_TERRAIN_TILES_URL?.trim() || DEFAULT_TERRAIN_TILES_URL;
  const encoding = validateTerrainEncoding(
    process.env.NEXT_PUBLIC_TERRAIN_ENCODING?.trim() || DEFAULT_TERRAIN_ENCODING
  );
  const tileSize = validateTerrainTileSize(
    process.env.NEXT_PUBLIC_TERRAIN_TILE_SIZE?.trim() ||
      String(DEFAULT_TERRAIN_TILE_SIZE)
  );

  if (process.env.NEXT_PUBLIC_TERRAIN_TILES_URL?.trim()) {
    validateUrl("NEXT_PUBLIC_TERRAIN_TILES_URL", tilesUrl);
  }

  return {
    tilesUrl,
    encoding,
    tileSize,
    hasPublicDefault: true,
  };
}
