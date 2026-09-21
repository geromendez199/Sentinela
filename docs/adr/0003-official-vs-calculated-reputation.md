# ADR 0003 - Reputacion oficial separada del gemelo calculado

Estado: aceptada (2026-09-21)

## Contexto

Sentinela necesita proyectar reputacion, pero la cifra que le importa al vendedor
es la oficial de MercadoLibre. Un calculo interno que se presente como oficial
destruye la confianza en el producto la primera vez que difiere.

## Decision

Dos tablas separadas: `reputation_snapshots` (oficial observado, sin
reinterpretar) y `reputation_computations` (gemelo calculado, versionado por
rule set). Toda divergencia se registra como drift; tres snapshots consecutivos
fuera de tolerancia degradan la fidelidad y la cuenta.

## Consecuencias

- La UI siempre dice cual cifra es oficial y cual calculada.
- El drift es observable y accionable en lugar de silencioso.
- La ventana se lee de `metrics.*.period`, lo que neutraliza cambios de politica
  y el conflicto oficial de MLU.
- Se requiere disciplina: nunca "arreglar" el calculo para que coincida sin
  explicar la causa de la diferencia.
