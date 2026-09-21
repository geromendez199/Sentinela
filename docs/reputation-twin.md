# Gemelo digital de reputacion

## Dos capas que nunca se mezclan

- **Oficial observado**: `GET /users/{id}.seller_reputation`, persistido en
  `reputation_snapshots` sin reinterpretar `level_id`, `power_seller_status` ni
  las metricas.
- **Gemelo calculado**: `reputation_computations`, con su propia version de
  reglas y su denominador local.

La UI siempre etiqueta cual es cual. El calculo interno no reemplaza al oficial.

## Ventanas por sitio

| Sitio | Condicion de alto volumen | Ventana alto volumen | Bajo volumen | Estado |
| --- | --- | --- | --- | --- |
| MLA | >= 50 ventas en 60 dias | 60 dias | 365 dias | Verificado |
| MLB | >= 60 ventas en 60 dias | 60 dias | 365 dias | Verificado |
| MLM | >= 40 ventas en 60 dias | 60 dias | 365 dias | Verificado |
| MLC | >= 40 ventas en 60 dias | 60 dias | 365 dias | Verificado |
| MCO | >= 60 ventas en 60 dias | 60 dias | 365 dias | Verificado |
| MLU | >= 25 completadas en 120 dias (developer docs) | 120 dias | 365 dias | **Conflicto**: otra pagina oficial indica 41 |

**Regla de runtime**: nunca inferir la ventana con el conteo local. Se lee
`metrics.*.period` de cada snapshot oficial y se registra cualquier diferencia
contra el rule set. Esto neutraliza cambios de politica y el conflicto de MLU.

## Definiciones

- **Reclamos**: ventas con reclamo de comprador sobre ventas consideradas.
  `/claims/{id}/affects-reputation` clasifica el reclamo concreto; un reclamo
  resuelto o excluido puede dejar de afectar y debe reconsultarse.
- **Cancelaciones**: cancelaciones atribuibles al vendedor sin reclamo. Las
  iniciadas por el comprador no afectan. Si hubo reclamo y luego cancelacion, el
  impacto se trata como reclamo.
- **Demoras de despacho**: de `ready_to_ship` a `shipped` (en cross docking puede
  ser `in_hub` -> `shipped`). Aplica a ME2 y requiere volumen minimo. Un envio
  tardio en un pack puede afectar a cada orden del pack.
- **Atribucion de transportista**: no existe un booleano publico universal por
  envio equivalente a `affects-reputation`. El gemelo usa `/sla`, `/delays`, el
  historial de estados y la reconciliacion.

## Los dos margenes de seguridad

"Cuantos incidentes mas tolera" es ambiguo, asi que Sentinela muestra tres
numeros distintos por metrica:

1. **Headroom sobre ventas ya contabilizadas**: cuantos incidentes pueden
   aparecer sobre ordenes ya incluidas en el denominador.
2. **Headroom de proximas ventas incidentadas**: cada venta nueva sube numerador
   y denominador; se busca el mayor `k` que sigue cumpliendo el umbral.
3. **Recuperacion por ventas sanas**: minimo `k` de ventas sin incidente para
   volver bajo el umbral.

Los tres respetan el comparador (`<` o `<=`) del rule set.

## Drift y fidelidad

```
drift.value = local_value - official_value
drift.rate  = local_rate  - official_rate
tolerancia  = max(0.001, 1 / max(denominador, 1))

si |value_delta| > 1 o |rate_delta| > tolerancia
   durante >= 3 snapshots consecutivos -> fidelity = degraded
```

Una cuenta con gemelo degradado pasa a estado `degraded` y la UI baja la
confianza mostrada. La divergencia se muestra; nunca se oculta.

## Proyecciones

Tres escenarios (base, conservador, recuperacion) a 7, 14 y 30 dias. Cada punto
expone sus factores: incidentes que salen de la ventana, ventas esperadas e
incidentes esperados. No se muestra un numero unico sin contexto, y una fecha de
expiracion que no pudo confirmarse se marca como estimada.
