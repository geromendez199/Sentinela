# ADR 0004 - Toda escritura a MercadoLibre requiere aprobacion humana

Estado: aceptada (2026-09-21)

## Contexto

Una escritura equivocada a MercadoLibre (un mensaje fuera de politica, una
publicacion pausada, un stock corrompido) tiene consecuencias comerciales reales
e irreversibles. Buena parte de los contratos de escritura todavia no esta
verificada en documentacion oficial vigente.

## Decision

Toda escritura nace como `action_draft` con `requires_approval = true`. La
ejecucion es un paso separado que vuelve a leer el recurso y la politica vigente
inmediatamente antes del write. Si algo cambio desde la aprobacion, el draft pasa
a `blocked_policy` con motivo. Existen kill switches global, por organizacion y
por cuenta, y el MVP arranca con la escritura deshabilitada.

## Consecuencias

- Un borrador libre no implica que el mensaje pueda enviarse: manda el action
  guide, los caps y el estado de la conversacion.
- Cada ejecucion tiene clave de idempotencia y queda auditada.
- El producto es mas lento que un automatismo puro, deliberadamente.
- Habilitar una automatizacion requiere primero pasar el contract test del flujo.
