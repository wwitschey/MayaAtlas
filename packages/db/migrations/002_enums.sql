CREATE TYPE certainty_level AS ENUM ('high', 'medium', 'low', 'disputed');
CREATE TYPE location_precision AS ENUM ('exact', 'approximate', 'inferred', 'generalized');
CREATE TYPE site_type AS ENUM ('city', 'center', 'ceremonial_center', 'settlement', 'cave', 'port', 'fortification', 'ritual_complex', 'architectural_group', 'unknown');
CREATE TYPE alias_type AS ENUM ('alternate_spelling', 'historic_name', 'colonial_name', 'local_name', 'indigenous_name', 'transliteration', 'scholarly_variant', 'other');
CREATE TYPE temporal_assertion_type AS ENUM ('occupation', 'florescence', 'abandonment', 'construction_phase', 'dynastic_peak', 'event');
CREATE TYPE public_status AS ENUM ('draft', 'review', 'published', 'hidden');
