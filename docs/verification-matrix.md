# Matriz de verificacion y plan de prueba empirica

Todo punto sin confirmacion oficial vigente vive detras de un flag en
`src/lib/meli/capabilities.ts` y no puede habilitarse sin pasar su prueba.

| # | Punto | Estado | Riesgo si se asume mal | Prueba empirica | Bloquea |
| --- | --- | --- | --- | --- | --- |
| 1 | TTL del access token (10800 vs 21600) | Conflicto oficial | Tokens vencidos o refrescos innecesarios | Medir `expires_in` real por cuenta y sitio durante 7 dias | Nada: el codigo ya usa `expires_in` |
| 2 | Ventana reputacional de MLU (25 vs 41 ventas) | Conflicto oficial | Ventana equivocada, gemelo falso | Comparar `metrics.*.period` observado contra ambas reglas | Nada: gana el period runtime |
| 3 | Rate limits por endpoint | No verificado | 429 en cascada o subutilizacion | Telemetria de 429 por bucket y ajuste del multiplicador aprendido | Aumentar presupuestos |
| 4 | Max offset de `/orders/search` | No verificado | Backfill incompleto | Probar offsets crecientes en cuenta de test | Ampliar ventanas de backfill |
| 5 | Contrato write de `/claims/{id}/messages` | No verificado | Write fallido o duplicado | Contract test en cuenta de test | `claims.write_messages` |
| 6 | `available_actions` de reclamos | No verificado | Ejecutar una accion no habilitada | Contract test por flujo | `claims.execute_action` |
| 7 | Adjuntos de devoluciones (`return_id`) | No verificado | Evidencia perdida | Contract test del flujo completo | `returns.attachments` |
| 8 | Envio de mensaje posventa (texto libre vs option) | No verificado | Mensaje rechazado o fuera de politica | Probar action guide + caps antes de enviar | `messages.send` |
| 9 | Limites de adjuntos de mensajes | No verificado | Subida rechazada | Probar tamanos y tipos | `messages.attachments` |
| 10 | `PUT /items/{id}` para pausar | No verificado | Publicacion pausada mal | Pausar/despausar un item de test | `items.pause` |
| 11 | Stock multiwarehouse por sitio/tipo | No verificado | Stock corrompido | Probar `x-version` y el 409 esperado | `stock.user_product_update` |
| 12 | `/missed_feeds` con topic items | No verificado | Recuperacion incompleta | Probar con y sin `site_id` | `missed_feeds.items_require_site` |
| 13 | `POST /answers` | No verificado | Respuesta publicada mal | Contract test | `questions.answer` |
| 14 | Hosts de autorizacion MLM/MLC/MCO/MLU | No verificado | OAuth roto por sitio | Probar el redirect real por sitio | Habilitar esos sitios |
| 15 | Fecha exacta de salida de ventana de un incidente | No verificado | Proyecciones corridas | Comparar expiraciones estimadas contra snapshots oficiales | Nada: se marca estimado |

## Procedimiento

1. Ejecutar `npm run verify:contracts` con credenciales de una cuenta de test.
2. Registrar el resultado y la fecha en `docs/meli-contracts.md`.
3. Cambiar el flag en `src/lib/meli/capabilities.ts` solo si el contract test paso.
4. Agregar un test de regresion con el fixture sanitizado de la respuesta.
