# Privacidad

## Principios

- **Minimizacion**: se persisten los campos necesarios para operar y una version
  sanitizada del payload para diagnostico (`raw_sanitized`). Nunca la respuesta
  completa con PII.
- **Pseudonimizacion**: el comprador se identifica con un pseudonimo derivado por
  HMAC, estable por cuenta y sin valor fuera del sistema.
- **Sanitizacion antes del LLM**: emails, telefonos, documentos, direcciones,
  tarjetas y URLs se reemplazan por placeholders tipados antes de cualquier
  llamada al proveedor de IA o embeddings. El mapa de placeholders vive en
  memoria del request y nunca se persiste ni se envia al proveedor.
- **Texto externo es dato, no instruccion**: se neutraliza contenido con forma de
  instruccion y se lo encapsula en una etiqueta que el system prompt declara no
  confiable.
- **Sin PII en logs**: tokens, secretos, headers `Authorization` y payloads
  completos estan redactados en el logger.

## Datos que se procesan

| Categoria | Ejemplos | Base |
| --- | --- | --- |
| Operativos de venta | Orden, envio, SLA, estados | Necesarios para el servicio |
| Texto posventa sanitizado | Mensajes, preguntas, descripcion de reclamos | Deteccion de riesgo y causa raiz |
| Identidad del vendedor | `seller_id`, nickname, sitio | Vinculo de la cuenta |
| Identidad del usuario | Email de Supabase Auth | Autenticacion y auditoria |

No se envian imagenes ni documentos de compradores al proveedor de IA en el MVP.

## Derechos de los titulares

`data_subject_requests` registra acceso, rectificacion, supresion, limitacion y
otros pedidos, con fecha de recepcion y vencimiento. La respuesta se coordina con
el vendedor, que es el responsable del tratamiento frente a su comprador.

## Retencion

Ver `docs/data-retention.md`. Un legal hold suspende cualquier purga.
