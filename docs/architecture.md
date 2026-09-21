# Arquitectura de Sentinela ML

Sentinela ML es un SaaS multi-organizacion, multi-cuenta y multi-sitio (MLA, MLB,
MLM, MLC, MCO, MLU) que anticipa incidentes capaces de degradar la reputacion de
un vendedor de MercadoLibre.

El ciclo cerrado del producto es siempre el mismo:

```
observar la verdad oficial
  -> reconstruir el estado reputacional
  -> estimar riesgo por venta
  -> sugerir una intervencion segura
  -> medir resultado
  -> recalibrar
```

## Diagrama logico

```
[Browser / Next.js UI]
       |  Supabase Auth session + publishable key
       v
[Next.js App Router on Vercel] -------------------------------+
       | lecturas org-aware / comandos de aprobacion           |
       | (sin tokens MELI)                                     |
       v                                                       |
[Supabase Postgres + RLS] <---- Supabase Realtime ------------+
       ^       ^       ^
       |       |       +-- estado actual de riesgo/reputacion/acciones
       |       +---------- documentos de causa raiz (pgvector)
       +------------------ estado de org/cuenta/orden/reclamo/item

MercadoLibre ---> [Supabase Edge: meli-webhook]
                        | valida + deduplica + encola
                        | ACK 200 < 500 ms
                        v
                    [pgmq]
                        v
               [Supabase Edge workers]
                 | token broker -> Vault
                 | rate budget
                 | GET del recurso oficial
                 | upsert idempotente
                 | recalculo de riesgo/gemelo
                 v
              [Postgres/RLS]

[pg_cron + pg_net] -> missed_feeds / reconciliacion incremental /
                      chunks de backfill / retencion / pulsos de worker

[LLM/Embeddings] <- solo texto sanitizado
[Notificaciones] <- solo payload operativo minimo
```

## Limites de responsabilidad

| Componente | Responsabilidad | No debe hacer |
| --- | --- | --- |
| Next.js/Vercel | UI, sesion Supabase, routing por organizacion, aprobaciones, OAuth connect/callback estable | Backfills masivos, recibir la tormenta principal de webhooks, guardar tokens MELI en el cliente |
| Supabase Edge Functions | Ingress de webhooks, workers, token broker, cliente MELI, IA, writes aprobados, alertas | Sostener locks de DB durante HTTP externo, confiar en el payload del webhook |
| PostgreSQL | Estado, RLS, leases, colas pgmq, snapshots, auditoria, rate buckets, features, embeddings | Exponer Vault o el schema `private` a `anon`/`authenticated` |
| Vercel previews | Preview de UI sin credenciales productivas | Registrar redirect URIs dinamicas en MercadoLibre |
| MercadoLibre | Fuente de verdad externa | — |
| Proveedor LLM | Clasificar texto sanitizado y devolver JSON validado | Decidir writes, recibir PII innecesaria, obedecer instrucciones del comprador |

## Decisiones que moldean todo el sistema

1. **El refresh token es rotativo y de un solo uso.** Un refresh concurrente no
   es un retry: puede invalidar la cuenta. Por eso existe un token broker con
   lease persistente y CAS sobre `credential_version`
   (`src/lib/meli/token-broker.ts`, `supabase/functions/_shared/token-broker.ts`).
2. **El TTL del access token nunca se hardcodea.** La documentacion oficial
   muestra ejemplos inconsistentes (10800 vs 21600); el codigo usa siempre el
   `expires_in` de la respuesta.
3. **Los webhooks son punteros de cambio, no estado.** El ingress deduplica,
   encola y responde 200 en menos de 500 ms; el worker hace el GET oficial.
4. **La reputacion vive en dos capas separadas.** `reputation_snapshots` guarda
   lo oficial observado y `reputation_computations` el gemelo calculado. Si
   divergen se registra drift y se degrada la fidelidad: la divergencia se
   muestra, no se oculta.
5. **La ventana reputacional se lee en runtime.** `metrics.*.period` del snapshot
   oficial gana sobre cualquier inferencia local, lo que neutraliza cambios de
   politica y la contradiccion oficial de MLU (25 vs 41 ventas).
6. **Todo write a MercadoLibre pasa por aprobacion humana** y un chequeo de
   politica inmediatamente antes de ejecutar.

## Estados de una cuenta

`onboarding -> backfilling -> active`, con `degraded`, `reconnect_required`,
`restricted` y `disconnected` como desvios. Cada estado cambia lo que la UI
muestra y lo que los workers tienen permitido hacer; ver
`src/lib/supabase/database.types.ts` y la pagina de cuentas.

## Estructura del codigo

- `src/app` — App Router: paginas por organizacion y route handlers.
- `src/lib/meli` — cliente, OAuth, token broker, rate budget, adapters y tipos.
- `src/lib/reputation` — rule sets, gemelo, margenes y proyecciones.
- `src/lib/risk` — features, modelo heuristico y explicaciones.
- `src/lib/playbooks` — catalogo de acciones, reglas y chequeo de politica.
- `src/lib/ai` — sanitizacion, defensa de prompt, clasificador y causa raiz.
- `supabase/migrations` — fuente de verdad del esquema.
- `supabase/functions` — ingress y workers.
