# Sentinela ML

Motor predictivo de proteccion de reputacion y resolucion proactiva de reclamos
para vendedores de MercadoLibre.

Sentinela observa la verdad oficial de MercadoLibre, reconstruye el estado
reputacional de cada cuenta, estima riesgo por venta, propone una intervencion
segura y mide el resultado para recalibrarse.

## Stack

Next.js App Router + Tailwind CSS, Supabase (PostgreSQL, RLS, Edge Functions,
pgmq, Realtime, pg_cron/pg_net, Vault), Vercel y GitHub. Se admite un unico
proveedor de LLM/embeddings y uno de notificaciones salientes, ambos detras de
una interfaz y con secretos server-side.

## Reglas no negociables

1. Solo APIs oficiales de MercadoLibre. Nada de scraping ni endpoints privados.
2. Los tokens de MercadoLibre viven en Supabase Vault, nunca llegan al browser,
   nunca se guardan en `localStorage` ni en cookies.
3. RLS obligatoria en toda tabla de negocio expuesta, con test de aislamiento.
4. Los webhooks son punteros de cambio: se deduplica, se encola, se responde 200
   en menos de 500 ms y recien despues se consulta el recurso oficial.
5. El refresh token es rotativo y de un solo uso: solo el token broker refresca,
   con lease y CAS.
6. El TTL del access token sale de `expires_in`, nunca hardcodeado.
7. La reputacion oficial y la calculada se almacenan por separado; el drift se
   muestra, no se oculta.
8. Toda escritura a MercadoLibre requiere aprobacion humana y un chequeo de
   politica inmediatamente antes de ejecutar. El MVP arranca con writes
   deshabilitados.
9. El texto del comprador se sanitiza antes de la IA y se trata como dato, nunca
   como instruccion.
10. Las migraciones SQL son la fuente de verdad del esquema.

## Puesta en marcha local

```bash
cp .env.example .env.local          # completar valores; nunca commitear
npm install
supabase start
supabase db reset                   # aplica migraciones + seed
npm run verify:env
npm run dev
```

Para una organizacion de demostracion:

```bash
DEMO_USER_PASSWORD='...' npm run seed:demo
```

## Comandos

| Comando | Que hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de produccion |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript estricto |
| `npm test` | Tests unitarios y de integracion |
| `npm run db:reset` | Recrea la base local desde las migraciones |
| `npm run db:test` | Tests de RLS/SQL |
| `npm run verify:env` | Valida el contrato de entorno |
| `npm run verify:contracts` | Prueba los endpoints de MercadoLibre contra una cuenta de test |

## Estructura

```
src/app          paginas por organizacion y route handlers
src/lib/meli     cliente, OAuth, token broker, rate budget, adapters
src/lib/reputation  rule sets, gemelo, margenes, proyecciones
src/lib/risk     features, modelo heuristico, explicaciones
src/lib/playbooks  catalogo de acciones, reglas, policy check
src/lib/ai       sanitizacion PII, defensa de prompt, clasificador, causa raiz
supabase/migrations  esquema (fuente de verdad)
supabase/functions   webhook ingress y workers
docs             arquitectura, contratos, runbooks, ADRs
```

## Orden de construccion

A. Bootstrap · B. Auth y multi-tenancy · C. OAuth y token broker · D. Cliente
MELI y rate budget · E. Webhooks y workers · F. Sync/backfill · G. Gemelo de
reputacion · H. Motor de riesgo · I. Playbooks y aprobaciones · J. Causa raiz ·
K. Dashboard, alertas y pruebas de carga · L. Deploy y rollout gradual.

## Documentacion

- [Arquitectura](docs/architecture.md)
- [Contratos de MercadoLibre](docs/meli-contracts.md)
- [Matriz de verificacion](docs/verification-matrix.md)
- [Gemelo de reputacion](docs/reputation-twin.md)
- [Runbook de OAuth](docs/oauth-runbook.md)
- [Runbook de webhooks](docs/webhook-runbook.md)
- [Privacidad](docs/privacy.md) · [Retencion](docs/data-retention.md)
- [Respuesta a incidentes](docs/incident-response.md) · [Costos](docs/cost-model.md)
- ADRs: [0001](docs/adr/0001-event-driven-sync.md) ·
  [0002](docs/adr/0002-token-broker.md) ·
  [0003](docs/adr/0003-official-vs-calculated-reputation.md) ·
  [0004](docs/adr/0004-human-approved-writes.md)
