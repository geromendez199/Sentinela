# Retencion de datos

Los valores por defecto viven en `src/lib/privacy/retention.ts` y en el worker
`retention-purge`. Cada organizacion puede endurecerlos desde
`retention_policies`.

| Entidad | Dias por defecto | Motivo |
| --- | --- | --- |
| `webhook_events` | 30 | Diagnostico de ingreso; el estado vive en las tablas de negocio |
| `messages` | 400 | Cubre la ventana reputacional de 365 dias mas margen |
| `claim_messages` | 400 | Evidencia de reclamos dentro de la ventana |
| `questions` | 400 | Analisis de causa raiz pre-venta |
| `ai_classifications` | 400 | Trazabilidad de features derivadas de texto |
| `root_cause_documents` | 540 | Series de causa raiz por publicacion |
| `risk_scores` | 540 | Auditoria de decisiones y calibracion posterior |
| `security_audit_log` | 730 | Requisito de auditoria de seguridad |
| `internal_metrics` | 180 | Telemetria operativa |

## Reglas

- **Legal hold gana siempre.** Con `legal_hold = true` no se purga nada de esa
  entidad, ni siquiera por particion.
- `webhook_events` esta particionada por `received_at`: la purga puede hacerse
  por particion, pero solo tras verificar el hold.
- Desvincular una cuenta detiene los jobs; no borra datos. El borrado lo decide
  la politica de retencion o un pedido del titular.
- Las particiones se crean con dos meses de anticipacion y existe una particion
  default para que un fallo del job no pierda eventos.
