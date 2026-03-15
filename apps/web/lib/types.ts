export type SourceInfo = {
  short_citation?: string | null;
  title?: string | null;
  url?: string | null;
};

export type ChronologyEntry = {
  period_label?: string | null;
  start_year?: number | null;
  end_year?: number | null;
  assertion_type?: string | null;
  certainty?: string | null;
};

export type PopulationEstimate = {
  estimate_year?: number | null;
  population?: number | null;
  certainty?: string | null;
};

export type SiteSummary = {
  id: number;
  slug: string;
  display_name: string;
  canonical_name: string;
  site_type: string;
  country_code: string | null;
  short_description?: string | null;
  longitude: number;
  latitude: number;
};

export type SiteDetail = SiteSummary & {
  sources: SourceInfo[];
  aliases: string[];
  chronology: ChronologyEntry[];
  population_estimates: PopulationEstimate[];
  culture_area?: string | null;
  admin_region?: string | null;
};

export type LayerDefinition = {
  id: number;
  key: string;
  display_name: string;
  description?: string | null;
  layer_type: string;
  default_visible: boolean;
  z_index: number;
};

export type DataSourceDefinition = {
  id: number;
  layer_id: number;
  source_type: string;
  source_url?: string | null;
  source_query?: string | null;
  display_order: number;
};

export type LayerStyleDefinition = {
  id: number;
  layer_id: number;
  paint_properties?: Record<string, any> | null;
  layout_properties?: Record<string, any> | null;
  filter_expression?: any[] | null;
};

export type LayerRenderConfig = {
  id: string;
  type: 'geojson' | 'raster' | 'vector_tiles';
  source: any;
  paint?: Record<string, any>;
  layout?: Record<string, any>;
  filter?: any[];
};
