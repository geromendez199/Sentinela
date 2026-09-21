# ADR 0001 - Sincronizacion event-driven con reconciliacion

Estado: aceptada (2026-09-21)

## Contexto

MercadoLibre entrega notificaciones que son punteros de cambio, no estado. Pueden
llegar duplicadas, desordenadas o perderse, y exigen ACK 200 en menos de 500 ms.
Hacer polling por orden no escala y consume presupuesto de rate limit.

## Decision

Ingress minimo que deduplica y encola, workers que hacen el GET oficial del
recurso y upsert idempotente guardado por `source_last_updated`, mas jobs
programados que completan lo que los webhooks no trajeron (`missed_feeds`,
incrementales por fecha, backfill reanudable).

## Consecuencias

- El ingress nunca llama a MercadoLibre, al LLM ni a notificaciones.
- Reprocesar un evento es seguro: los workers son idempotentes.
- Una notificacion vieja no puede retroceder el estado actual.
- Se necesita monitoreo de profundidad de cola y de `missed_feeds`, porque su
  retencion de ~2 dias define la ventana real de recuperacion.

## Alternativas descartadas

- Procesar dentro del webhook: viola el presupuesto de 500 ms.
- Confiar en el payload como estado: produce estado incorrecto ante desorden.
- Polling periodico completo: costo de rate limit inaceptable.
