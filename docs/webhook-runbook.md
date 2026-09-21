# Runbook de webhooks y colas

## Contrato de ingress

MercadoLibre exige ACK HTTP 200 dentro de 500 ms. `meli-webhook` solo:

1. Valida metodo, tamano, `application_id`, topic permitido y que el `user_id`
   corresponda a una cuenta conocida.
2. Calcula `event_key` (`appId:_id`, o SHA-256 de topic|resource|user|sent|actions).
3. Inserta en `webhook_dedupe` con `on conflict do nothing`, registra el evento y
   encola un sobre compacto en pgmq.
4. Devuelve 200.

Nunca dentro del ingress: refresh de token, llamada a la API de MercadoLibre,
llamada al LLM, recalculo de score, envio de notificaciones.

Un `user_id` desconocido se registra como `security_rejected` y no se procesa.

## Worker de recursos

El payload es un puntero: el worker siempre hace el GET oficial del recurso y
hace upsert idempotente guardado por `source_last_updated`. Una notificacion
vieja que llega tarde no retrocede el estado actual.

- Debounce por `account_id + resource_kind + external_id`.
- La historia (shipments, claims) es append-only con clave natural.
- Un cambio material encola los derivados: riesgo, reconciliacion, clasificacion.

## Errores y reintentos

| Situacion | Comportamiento |
| --- | --- |
| 429 | `Retry-After` si existe; si no, backoff exponencial con full jitter. Se penaliza el bucket de la cuenta. |
| 5xx | Retryable, con backoff. |
| 404 | Recurso ausente (por ejemplo `/sla` en Full): no es error fatal. |
| 401 | `reconnect_required`: se deja de reintentar el mensaje. |
| 403 | `restricted`: writes bloqueados. |
| >=5 lecturas del mensaje | Se marca el evento como `failed` y se saca de la cola. |

## Recuperacion

- `missed-feeds-sweep` corre cada 10-15 minutos. `/missed_feeds` retiene alrededor
  de dos dias, asi que una caida mas larga requiere reconciliacion incremental
  por fecha.
- Los eventos recuperados pasan por el mismo dedupe: reprocesar es seguro.

## Alertas operativas

| Condicion | Severidad |
| --- | --- |
| `missed_feeds` fallando > 30 min | warning |
| `missed_feeds` fallando > 6 h | critical |
| Profundidad de `meli_events` creciendo de forma sostenida | high |
| ACK p95 > 250 ms o p99 > 450 ms | high |
| Tasa de 429 por cuenta en aumento | warning |
