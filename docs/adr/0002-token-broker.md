# ADR 0002 - Token broker con lease persistente y CAS

Estado: aceptada (2026-09-21)

## Contexto

El refresh token de MercadoLibre es rotativo y de un solo uso. Dos refrescos
concurrentes no son un retry inofensivo: pueden invalidar la sesion de la cuenta.
Un lock de base de datos no sirve, porque la transaccion de PostgREST/RPC termina
antes de que se complete la llamada HTTP externa.

## Decision

Un unico componente (el token broker) puede llamar a `/oauth/token` con un
refresh token. Se protege con un lease persistente en `private.meli_oauth_credentials`
mas un CAS sobre `credential_version`. El nuevo refresh token se persiste con
reintentos antes de liberar el lease o hacer cualquier otro trabajo.

## Consecuencias

- 100 llamadas concurrentes producen un solo `POST /oauth/token`.
- Un worker caido no bloquea la cuenta: el lease expira a los 30 segundos.
- Un `invalid_grant` no dispara un bucle: la cuenta pasa a `reconnect_required`.
- El TTL sale siempre de `expires_in`, nunca hardcodeado.

## Alternativas descartadas

- `SELECT ... FOR UPDATE` o advisory locks durante el HTTP externo.
- Refresh oportunista en cada worker: rompe cuentas bajo concurrencia.
