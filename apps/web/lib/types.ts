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
