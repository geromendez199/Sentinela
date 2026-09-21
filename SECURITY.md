# Seguridad

## Reportar una vulnerabilidad

Escribir a security@sentinela.example con una descripcion del problema y los
pasos para reproducirlo. No abrir un issue publico. Respuesta objetivo: 72 horas.

## Modelo de amenazas

| Amenaza | Mitigacion |
| --- | --- |
| Exfiltracion de tokens de MercadoLibre | Los tokens viven en Supabase Vault; el schema `private` y `vault.decrypted_secrets` estan revocados para `anon`/`authenticated`; los RPC que devuelven material son backend-only; el logger redacta tokens |
| Acceso cruzado entre organizaciones | RLS en toda tabla de negocio, con tests de aislamiento entre dos orgs y dos cuentas |
| Escalada por rol | Matriz de permisos explicita; aprobacion y ejecucion de acciones requieren rol; la gestion de miembros pasa por RPC auditado |
| Webhook falsificado | Ruta con segmento secreto, validacion de `application_id`, allowlist de topics y de `user_id` conocido; un remitente desconocido queda como evento de seguridad |
| Replay de OAuth | `state` de un solo uso con TTL, consumido atomicamente; solo se persiste su hash |
| Refresh token robado o rotado dos veces | Refresh unicamente desde el token broker, con lease y CAS |
| Prompt injection desde texto del comprador | Sanitizacion determinista, neutralizacion de contenido con forma de instruccion y encapsulado en etiqueta declarada no confiable |
| Write no autorizado a MercadoLibre | Aprobacion humana obligatoria, policy check inmediatamente previo, clave de idempotencia, auditoria y kill switches |
| Fuga de PII al proveedor de IA | Redaccion de PII antes de cualquier llamada; el mapa de placeholders nunca sale del request |

## Practicas

- Ningun secreto en el repositorio. `.env.example` documenta el contrato.
- El browser usa unicamente la publishable key de Supabase.
- Nunca se loguean `access_token`, `refresh_token`, `code`, headers
  `Authorization` ni payloads completos con PII.
- Toda tabla nueva se considera incompleta hasta tener RLS, grants y test.
- Un contrato de MercadoLibre no verificado se mantiene detras de capability flag.
