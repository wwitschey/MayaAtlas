CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sites_updated_at
BEFORE UPDATE ON sites
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
