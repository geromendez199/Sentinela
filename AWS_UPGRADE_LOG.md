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

La validación local de migraciones no pudo ejecutarse porque Docker recibió `403 Forbidden` al descargar las imágenes de Supabase desde `public.ecr.aws`. Posteriormente, con la conexión administrativa de Supabase restablecida, las migraciones se aplicaron y verificaron en el proyecto de producción `ukohdtfikkaizykddvhy`. La auditoría confirmó las tablas, colas y funciones; no había mensajes pendientes en DLQ.

## Promoción

1. Crear un respaldo de la base y validar migraciones futuras en staging.
2. Las migraciones de resiliencia, auditoría, refresh recovery y colas ya están aplicadas en producción.
3. Las Edge Functions modificadas están desplegadas en versiones activas.
4. Los workers de cron quedaron reactivados; la primera ejecución manual de riesgo respondió HTTP 200.
5. Configurar Resend y `NOTIFICATIONS_FROM_EMAIL` sólo después de verificar el remitente y los destinatarios.
