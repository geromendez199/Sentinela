# Modelo de costos

Todas las cifras son **estimaciones** de dimensionamiento, no contratos de
proveedor. Se miden en produccion y se ajustan por telemetria.

## Supuestos por cuenta mediana

| Variable | Valor estimado |
| --- | --- |
| Ventas por dia | 150 |
| Webhooks por venta | 4-8 (orden, envio, mensajes, post-purchase) |
| Mensajes posventa por venta | 0,4 |
| Reclamos por venta | 0,015 |
| Recalculos de riesgo por orden | 3-5 durante su vida |

## Drivers de costo

1. **Egress y computo de Edge Functions**: proporcional a webhooks x cuentas.
   El debounce y el dedupe son la principal palanca de ahorro.
2. **Postgres**: dominado por `webhook_events` (particionado y purgado a 30 dias)
   y por los embeddings de causa raiz.
3. **LLM**: solo texto nuevo o materialmente distinto. El hash de contenido evita
   reclasificar lo mismo; es la segunda palanca mas grande.
4. **Embeddings**: 1536 dimensiones por documento de causa raiz; se generan una
   vez por documento.
5. **Notificaciones**: con throttling y dedupe por tipo de alerta.

## Palancas cuando el costo sube

- Bajar la frecuencia de reconciliacion para cuentas lejos de los umbrales.
- Subir el minimo de muestras para clustering de causa raiz.
- Acortar la retencion de `webhook_events`.
- Clasificar solo mensajes de comprador (ya es el comportamiento por defecto).
