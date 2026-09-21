# Respuesta a incidentes

## Severidades

| Nivel | Definicion | Respuesta |
| --- | --- | --- |
| critical | Perdida de datos, exposicion de credenciales, writes incorrectos a MercadoLibre | Inmediata; activar kill switch global |
| high | Sincronizacion detenida, gemelo degradado masivo, cola creciendo sin techo | < 1 h |
| warning | Degradacion parcial, 429 sostenidos, un job atrasado | < 1 dia habil |
| info | Ruido operativo | Backlog |

## Kill switches

1. **Global**: `MELI_WRITES_ENABLED=false` bloquea toda escritura a MercadoLibre.
2. **Por organizacion** y **por cuenta**: se evaluan en el policy check previo a
   cada write.

El MVP arranca con la escritura automatica deshabilitada.

## Playbooks

### Sospecha de exposicion de credenciales

1. Activar el kill switch global.
2. Rotar `MELI_CLIENT_SECRET` y la secret key de Supabase.
3. Forzar reconexion de las cuentas afectadas (`reconnect_required`).
4. Revisar `security_audit_log` por `action_executed` inesperados.
5. Confirmar que ningun token aparece en logs ni en respuestas.

### Write incorrecto a MercadoLibre

1. Kill switch global.
2. Identificar los `action_drafts` ejecutados y su `action_executions`.
3. Revertir manualmente donde la API lo permita (por ejemplo despausar un item).
4. Agregar el caso como test de policy check antes de reactivar.

### Sincronizacion detenida

1. Revisar profundidad de `meli_events` y estado de los `sync_jobs`.
2. Verificar `missed_feeds`: la retencion es de ~2 dias.
3. Si se supero esa ventana, lanzar reconciliacion incremental por fecha.
4. Marcar las cuentas como `degraded` mientras la confianza sea parcial.

### Drift persistente del gemelo

1. Confirmar que la ventana usada viene de `metrics.*.period`.
2. Revisar reclamos sin `affects-reputation` consultado.
3. Revisar atribucion de cancelaciones y demoras.
4. Mantener la fidelidad degradada hasta explicar la diferencia: nunca ajustar
   el calculo para que coincida sin entender la causa.
