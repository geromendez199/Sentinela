# Runbook de OAuth y custodia de tokens

## Flujo de vinculacion

1. `POST /api/integrations/meli/connect` valida rol `owner`/`admin`.
2. Se genera `state` aleatorio (32+ bytes) y se persiste solo su SHA-256 en
   `private.oauth_link_attempts`, con TTL de 10 minutos.
3. Si PKCE esta habilitado, el `code_verifier` se guarda en Vault, nunca en una
   columna legible ni en el browser.
4. Redirect al host de autorizacion del pais.
5. El callback consume la fila de `state` de forma atomica: un callback repetido
   no encuentra nada.
6. Intercambio del `code` en `/oauth/token` desde el servidor.
7. `GET /users/{id}` normaliza seller y sitio.
8. Si el `seller_id` ya esta vinculado y activo en otra organizacion, se rechaza.
9. Se crean dos secretos de Vault por cuenta (`access` y `refresh`) una sola vez.
10. La cuenta queda en `backfilling` y se encola el bootstrap.
11. Se audita `oauth_linked`. Nunca se loguea el `code` ni los tokens.

## Refresh

Solo el token broker refresca. El algoritmo:

1. Leer material y `credential_version`.
2. Si faltan mas de ~90-120 s (con jitter) para `expires_at`, devolver el token.
3. Tomar un lease atomico con CAS sobre `credential_version`.
4. Si no se obtiene el lease: esperar 100-400 ms y releer; si la version avanzo,
   usar el token nuevo; si no, error retryable.
5. Refrescar, y **persistir inmediatamente** el nuevo refresh token reintentando
   el commit local antes de cualquier otra cosa.
6. Liberar el lease.

Un refresh token rotado y no persistido es una cuenta perdida: por eso el commit
se reintenta antes de hacer cualquier otro trabajo.

## Incidentes

| Sintoma | Causa probable | Accion |
| --- | --- | --- |
| `invalid_grant` en refresh | Permiso revocado, credenciales cambiadas o refresh ya usado | La cuenta pasa a `reconnect_required`. No reintentar. Pedir nueva autorizacion al owner. |
| `refresh_in_progress` frecuente | Muchos workers compitiendo | Normal bajo rafaga: el mensaje se reencola. Si persiste, revisar leases huerfanos. |
| 401 tras refresh exitoso | Grant muerto del lado de MercadoLibre | `reconnect_required` y reconexion. |
| 403 en endpoints de lectura | Restriccion o suspension | Estado `restricted`: bloquear writes, permitir diagnostico. |
| `invalid_operator_user_id` | Autorizo un usuario operador | Repetir la vinculacion con el usuario principal/administrador. |
| Lease trabado | Worker caido durante el refresh | El lease expira solo (30 s). Si no, liberar con `backend_release_refresh_lease`. |

## Verificacion periodica

- 100 refrescos concurrentes simulados deben producir un unico `POST /oauth/token`
  (`tests/integration/oauth-race/refresh-lease.test.ts`).
- Ningun token debe aparecer en logs, respuestas al cliente ni tablas publicas.
- `vault.decrypted_secrets` y el schema `private` no deben ser accesibles para
  `anon`/`authenticated` (`supabase/tests/rls/isolation.test.sql`).
