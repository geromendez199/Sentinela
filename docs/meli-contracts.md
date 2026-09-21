# Contratos oficiales de MercadoLibre

Fecha de verificacion de referencia: **2026-09-21**.

Leyenda:

| Etiqueta | Significado | Accion de implementacion |
| --- | --- | --- |
| VERIFICADO | Confirmado en documentacion oficial vigente | Implementar segun contrato y agregar contract test |
| VERIFICADO CON CONFLICTO | Dos documentos oficiales vigentes no coinciden | No hardcodear la regla; usar respuesta runtime y configuracion versionada |
| NO VERIFICADO | Sin confirmacion oficial actual o documentacion ambigua | Adapter/feature flag, prueba empirica y automatizacion bloqueada hasta validar |
| ESTIMACION | Supuesto de capacidad/costo | Medir en produccion y ajustar por telemetria |

## Convenciones

- Base API: `https://api.mercadolibre.com`, autenticacion `Authorization: Bearer $ACCESS_TOKEN`.
- Scopes usados: `read`, `write`, `offline_access`. MercadoLibre no publica una
  matriz endpoint-a-scope granular; la tabla usa el minimo semantico esperado.
- Cada endpoint usado tiene un fixture sanitizado y un contract test de parsing.
  Un campo nuevo no debe romper el parser; un campo requerido faltante debe alertar.
- Los timestamps se guardan como `timestamptz`. Para SLA se usa el `expected_date`
  del recurso oficial, nunca un calendario propio de feriados.

## Tabla de endpoints

| Endpoint | Metodo | Scope | Modulo | Estado | Cache / polling |
| --- | --- | --- | --- | --- | --- |
| Authorization URL (host por pais) | GET | — | OAuth | VERIFICADO para MLA/MLB; resto NO VERIFICADO | Sin cache; redirect exacto por environment |
| `/oauth/token` (authorization_code) | POST | — | OAuth | VERIFICADO | Una vez por vinculo; `form-urlencoded`; usar `expires_in` |
| `/oauth/token` (refresh_token) | POST | offline_access | Token broker | VERIFICADO (cuota NO VERIFICADA) | Solo el token broker; refresh rotativo; lease + CAS |
| `/sites` | GET | read | Config | NO VERIFICADO | Cache 24 h con fallback versionado |
| `/users/{user_id}` | GET | read | Gemelo/salud de cuenta | NO VERIFICADO (rate) | Eventual 5-15 min; sin polling por orden |
| `/orders/search` | GET | read | Backfill/incremental | NO VERIFICADO (max offset) | Event-driven + backfill por rangos de fecha; ~12 meses de horizonte |
| `/orders/{id}` | GET | read | Orden/riesgo | NO VERIFICADO | Por evento con debounce |
| `/packs/{pack_id}` | GET | read | Resolucion de pack | NO VERIFICADO | On demand |
| `/shipments/{id}` | GET | read | Envios/riesgo | NO VERIFICADO | Webhook + debounce; `x-format-new: true` |
| `/shipments/{id}/orders` | GET | read | Relacion shipment-pack-order | NO VERIFICADO | Al descubrir/actualizar; `X-New-Domain: true` |
| `/shipments/{id}/sla` | GET | read | SLA/riesgo | NO VERIFICADO | 15 min cerca del deadline, 1 h si lejano; no aplica a Full/cancelados |
| `/shipments/{id}/history` | GET | read | Timeline | NO VERIFICADO | Solo investigacion |
| `/shipments/{id}/delays` | GET | read | Senal de demora | NO VERIFICADO | 404 puede significar ausencia de demoras |
| `/messages/packs/{pack}/sellers/{seller}?tag=post_sale` | GET | read | Mensajes | 500 RPM (pool GET) | Webhook-driven; `mark_as_read=false` |
| `/messages/packs/{pack}/sellers/{seller}?tag=post_sale` | POST | write | Playbook | 500 RPM (pool writes) | Solo accion aprobada; max 350 caracteres |
| `/messages/action_guide/packs/{pack}?tag=post_sale` | GET | read | Politica de mensajes | Limites no publicados | TTL corto (1-5 min) antes de cada envio |
| `/messages/action_guide/packs/{pack}/caps_available?tag=post_sale` | GET | read | Politica de mensajes | NO VERIFICADO | Antes de cada mensaje seller-initiated |
| `/messages/action_guide/packs/{pack}/option?tag=post_sale` | POST | write | Playbook | Pool de writes | Solo tras aprobacion y con opcion habilitada |
| `/messages/attachments?tag=post_sale&site_id={site}` | POST | write | Adjuntos | NO VERIFICADO (exacto) | <=25 MB; JPG/PNG/PDF/TXT; asociar en 48 h |
| `/post-purchase/v1/claims/search` | GET | read | Claims sync/backfill | NO VERIFICADO | `offset+limit < 10000`: division por fechas obligatoria |
| `/post-purchase/v1/claims/{id}` | GET | read | Estado de reclamo | NO VERIFICADO | Webhook `post_purchase` + debounce |
| `/post-purchase/v1/claims/{id}/detail` | GET | read | Playbook de reclamo | NO VERIFICADO | Trae `due_date`, `action_responsible`, `problem` |
| `/post-purchase/v1/claims/{id}/affects-reputation` | GET | read | Exactitud del gemelo | NO VERIFICADO | Refetch al cambiar estado/resolucion |
| `/post-purchase/v1/claims/reasons/{reason_id}` | GET | read | Taxonomia/causa raiz | NO VERIFICADO | Cache 24 h; no hardcodear el mapa de reasons |
| `/post-purchase/v1/claims/{id}/messages` | GET/POST | read/write | Evidencia de reclamo | NO VERIFICADO (write) | Write detras de capability flag |
| `/post-purchase/v2/claims/{id}/returns` | GET | read | Devoluciones | NO VERIFICADO | On related return |
| `/post-purchase/v1/claims/{id}/returns/attachments` | POST | write | Evidencia de devolucion | NO VERIFICADO | Solo flujo habilitado y aprobado |
| `/questions/search?api_version=4` | GET | read | Preguntas/causa raiz | NO VERIFICADO | `seller_id` primario; `item` vs `item_id` ambiguo |
| `/questions/{id}?api_version=4` | GET | read | Pregunta | NO VERIFICADO | On notification |
| `/answers` | POST | write | Respuesta a preguntas | NO VERIFICADO | Solo si un playbook futuro lo habilita; max 2000 caracteres |
| `/users/{id}/items/search` | GET | read | Catalogo | NO VERIFICADO | Scan para >1000; `limit` max 100 |
| `/items/bulk?ids=...` | GET | read | Multiget de items | NO VERIFICADO | Max 20 IDs; endpoint bulk nuevo |
| `/items/{id}` | PUT | write | Pausa/metadata | NO VERIFICADO | Solo aprobado; `available_quantity` no sirve para multi-origin |
| `/user-products/{id}/stock` | GET | read | Stock consistente | 100 RPM (doc de convivencia Full/Flex) | Cache corto; comparar `x-version` |
| `/user-products/{id}/stock/type/...` | PUT | write | Stock multiwarehouse | NO VERIFICADO por sitio/tipo | `x-version` obligatorio; 409 fuerza refetch |
| `/inventories/{inventory_id}/stock/fulfillment` | GET | read | Stock Full | NO VERIFICADO | Senal operativa de solo lectura |
| `/missed_feeds?app_id={app_id}` | GET | read | Recuperacion | NO VERIFICADO | Cron 10-15 min; retiene ~2 dias |

## OAuth

- `state` lo genera y valida Sentinela; MercadoLibre lo devuelve pero no lo valida.
- PKCE se usa con `S256` cuando la aplicacion lo tiene habilitado.
- `redirect_uri` debe coincidir exactamente con la registrada.
- El refresh token es rotativo y de un solo uso: persistir el nuevo antes de
  liberar el lease.
- `invalid_grant` no dispara un bucle de refresh: cambia el estado de la cuenta a
  `reconnect_required`.
- Solo el usuario principal/administrador debe autorizar; un operador puede
  producir `invalid_operator_user_id`.

## Como se verifica

`npm run verify:contracts` prueba cada endpoint contra una cuenta de test y
reporta el resultado. Ningun flag de `src/lib/meli/capabilities.ts` se habilita
automaticamente: se cambia a mano cuando el contract test pasa y se registra
aqui con su fecha.
