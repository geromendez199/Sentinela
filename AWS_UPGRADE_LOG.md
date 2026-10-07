# Sentinela AWS-level upgrade log

Fecha: 2026-10-07

## Fase 1 — Entrega de eventos

- Se agregó `meli_events_dlq` con PGMQ.
- El worker de webhooks reintenta como máximo tres entregas y mueve el mensaje de forma transaccional a la DLQ.
- `dead_letter_events` permite inspección administrativa sin exponer PGMQ a la Data API.
- `queue_idempotency` y `backend_queue_send_once` evitan trabajos derivados duplicados.
- Todos los RPC de colas tienen allowlist, límites de lote, visibilidad y demora.

## Fase 2 — Límite Mercado Libre

- `MeliClient` aplica backoff exponencial con jitter completo ante red, 429 y 5xx.
- Sólo reintenta escrituras que incluyen una clave de idempotencia.
- El circuit breaker abre después de cinco fallos y permite una única sonda después de 60 segundos.
- Los errores de circuito son reintentables; los workers conservan el trabajo en PGMQ o `sync_jobs` en vez de perderlo.

## Fase 3 — Auditoría

- `immutable_audit_events` es un ledger append-only con hash SHA-256 por evento.
- Un trigger rechaza toda actualización o eliminación, incluso si una fila operativa se elimina después.
- Los triggers cubren acciones, ejecuciones, alertas, playbooks, retención, membresías y cuentas vinculadas.
- Se registra actor, acción, recurso, instante, correlación y estado anterior; se excluyen textos y payloads sensibles.
- Los eventos semánticos existentes de `security_audit_log` se reflejan automáticamente en el ledger.

## Fase 4 — Seller UX

- Órdenes, reclamos y publicaciones admiten selección múltiple, copiar IDs y exportar CSV.
- El límite de error del panel mantiene disponible el shell y ofrece reintento con diagnóstico.
- Las alertas se muestran como leídas inmediatamente y revierten el estado visual si falla la petición.
- Los reconocimientos repetidos se resuelven como éxito idempotente.

## Validación

- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- `npm test`: 130 pruebas aprobadas.
- `npm run build`: aprobado usando valores públicos de entorno exclusivos para compilación.
- `git diff --check`: aprobado.

La validación local de migraciones no pudo ejecutarse porque Docker recibió `403 Forbidden` al descargar las imágenes de Supabase desde `public.ecr.aws`. No se aplicaron cambios a la base de producción. Antes de promover las migraciones, se debe ejecutar `supabase db reset`, `supabase test db` y los asesores de seguridad/rendimiento en un entorno con acceso al registro.

## Promoción

1. Crear un respaldo de la base y validar las dos migraciones nuevas en staging.
2. Aplicar migraciones en producción durante una ventana observada.
3. Desplegar las Edge Functions modificadas.
4. Confirmar métricas de `meli_events`, reintentos y `dead_letter_events`.
5. Configurar una alerta operativa para toda entrada nueva en la DLQ.
