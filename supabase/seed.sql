-- Sentinela ML - seed data for local development and CI.
-- Contains no personal data and no credentials.

-- Reputation rule sets. Thresholds come from official MercadoLibre quality tables
-- (Master Build Specification v1.0, section 4.1). Runtime still prefers
-- seller_reputation.metrics.*.period over these window values.
insert into public.reputation_rule_sets
  (site_id, version, effective_from, high_volume_window_days, low_volume_window_days,
   high_volume_min_sales, thresholds, comparators, source_url, verification_status, verified_at)
values
  ('MLA','2026-09-01','2026-09-01',60,365,50,
   '{"claims":{"target":0.010,"green":0.015,"yellow":0.030,"orange":0.060},
     "cancellations":{"target":0.005,"green":0.010,"yellow":0.025,"orange":0.030},
     "delayed_handling_time":{"target":0.080,"green":0.100,"yellow":0.150,"orange":0.220}}'::jsonb,
   '{"claims":"lte","cancellations":"lte","delayed_handling_time":"lte"}'::jsonb,
   'https://www.mercadolibre.com.ar/ayuda/reputacion-vendedor_994','verified', now()),
  ('MLB','2026-09-01','2026-09-01',60,365,60,
   '{"claims":{"target":0.010,"green":0.020,"yellow":0.045,"orange":0.080},
     "cancellations":{"target":0.005,"green":0.015,"yellow":0.035,"orange":0.040},
     "delayed_handling_time":{"target":0.060,"green":0.100,"yellow":0.180,"orange":0.220}}'::jsonb,
   '{"claims":"lte","cancellations":"lte","delayed_handling_time":"lte"}'::jsonb,
   'https://www.mercadolivre.com.br/ajuda/reputacao-vendedor_994','verified', now()),
  ('MLM','2026-09-01','2026-09-01',60,365,40,
   '{"claims":{"target":0.010,"green":0.015,"yellow":0.030,"orange":0.060},
     "cancellations":{"target":0.005,"green":0.010,"yellow":0.025,"orange":0.030},
     "delayed_handling_time":{"target":0.080,"green":0.100,"yellow":0.150,"orange":0.220}}'::jsonb,
   '{"claims":"lte","cancellations":"lte","delayed_handling_time":"lte"}'::jsonb,
   'https://www.mercadolibre.com.mx/ayuda/reputacion-vendedor_994','verified', now()),
  ('MLC','2026-09-01','2026-09-01',60,365,40,
   '{"claims":{"target":0.025,"green":0.035,"yellow":0.055,"orange":0.070},
     "cancellations":{"target":0.015,"green":0.025,"yellow":0.070,"orange":0.090},
     "delayed_handling_time":{"target":0.100,"green":0.120,"yellow":0.180,"orange":0.260}}'::jsonb,
   '{"claims":"lte","cancellations":"lte","delayed_handling_time":"lte"}'::jsonb,
   'https://www.mercadolibre.cl/ayuda/reputacion-vendedor_994','verified', now()),
  ('MCO','2026-09-01','2026-09-01',60,365,60,
   '{"claims":{"target":0.025,"green":0.035,"yellow":0.055,"orange":0.070},
     "cancellations":{"target":0.015,"green":0.025,"yellow":0.070,"orange":0.090},
     "delayed_handling_time":{"target":0.100,"green":0.120,"yellow":0.180,"orange":0.260}}'::jsonb,
   '{"claims":"lte","cancellations":"lte","delayed_handling_time":"lte"}'::jsonb,
   'https://www.mercadolibre.com.co/ayuda/reputacion-vendedor_994','verified', now()),
  -- MLU: developer docs say >=25 completed sales in 120 days, another official page says 41.
  -- Stored as conflict; the runtime window always comes from metrics.*.period.
  ('MLU','2026-09-01-conflict','2026-09-01',120,365,25,
   '{"claims":{"target":0.025,"green":0.035,"yellow":0.055,"orange":0.070},
     "cancellations":{"target":0.015,"green":0.025,"yellow":0.070,"orange":0.090},
     "delayed_handling_time":{"target":0.100,"green":0.120,"yellow":0.180,"orange":0.260}}'::jsonb,
   '{"claims":"lte","cancellations":"lte","delayed_handling_time":"lte"}'::jsonb,
   'https://developers.mercadolibre.com.uy/es_ar/reputacion','conflict', now())
on conflict (site_id, version) do nothing;

-- Global heuristic risk model v0. Not statistically calibrated: the UI must show
-- "score de riesgo" plus calibration status, never a calibrated probability.
insert into public.risk_model_versions
  (org_id, name, version, model_type, intercept, weights, thresholds, feature_schema_version, active)
values
  (null,'baseline-heuristic','0.1.0','heuristic',-3.20,
   '{"sla_pressure":1.80,"shipment_exception":1.35,"stock_gap":1.55,"sku_claim_rate_z":0.90,
     "item_claim_rate_z":0.75,"message_package_intent":1.10,"message_product_issue":1.55,
     "urgency":0.95,"negative_sentiment":0.50,"response_latency":0.85,"capacity_pressure":1.10,
     "account_headroom":0.70}'::jsonb,
   '{"low":0.35,"medium":0.60,"high":0.80}'::jsonb,
   'fs-0.1.0', true)
on conflict do nothing;

-- Conservative default rate buckets. Real limits for most MercadoLibre endpoints are
-- not published; these are configurable budgets adjusted by 429 telemetry.
insert into private.meli_rate_buckets (bucket_key, capacity, tokens, refill_per_second)
values
  ('global:default', 600, 600, 10),
  ('global:messaging', 500, 500, 8),
  ('global:oauth', 60, 60, 1),
  ('global:stock', 100, 100, 1.6)
on conflict (bucket_key) do nothing;
