# Sentinela V2 — alcance y activación

Versión de aplicación: `2.0.0-beta.1`. Mantiene la identidad monocromática, el acceso por organización, OAuth con token broker, las políticas RLS, la aprobación humana, la auditoría y las colas de recuperación de V1.

## Recorridos de V2

| Función | Ruta | Comportamiento |
| --- | --- | --- |
| Resumen y prioridades | `/[org]/overview` | Datos disponibles, riesgo, alertas, acciones y acceso a atención/logística/calidad. |
| Atención pre y posventa | `/[org]/support` | Preguntas y mensajes del comprador, búsqueda/estado/orden/paginación, señales orientativas y plantillas editables. |
| Borradores asistidos | Atención y detalle de reclamo | Generación opcional con Anthropic/OpenAI, texto sanitizado, verificación de políticas y revisión humana. Guardar crea un borrador; no publica una respuesta. |
| Seguimiento de aprobación | `/[org]/actions` | Los borradores manuales se aprueban y copian. Las acciones externas conservan su flujo y verificaciones originales. |
| Despachos | `/[org]/dispatch` | Envíos sin despacho, orden por plazo informado, enlaces a órdenes y SLA sin fechas inventadas. |
| Calidad de publicación | `/[org]/quality` | Señales de título, atributos, fotos, estado y disponibilidad observados. Campos ausentes aparecen como desconocidos. |
| Experiencia por producto | `/[org]/listings/[item]` | Incidencia de reclamos por venta distinta, misma cuenta, muestra de ventas de 60 días. No es NCX oficial. |
| Resolución y evidencia | `/[org]/claims/[id]` | Conversación sincronizada, orden/envío vinculados, hechos disponibles, editor de causa/acción/preventivo/evidencia y exportación manual del plan. |
| Costos de resolución | Detalle de reclamo | Comparación de reembolso, logística, reposición y pérdida comercial bajo supuestos ingresados. No asigna un precio al termómetro reputacional. |
| Causas raíz | `/[org]/root-causes` | Agrupación por expresiones en hasta 200 reclamos de 30 días, separada de clusters semánticos existentes. |
| Sandbox de reputación | `/[org]/reputation` | Escenarios por métrica con ventas sanas e incidentes en ventas nuevas o contabilizadas; respeta umbral y comparador. No predice el color oficial. |
| Preparación operativa | `/[org]/settings/readiness` | Presencia de configuración del servidor web, seguimiento de trabajos y recorrido de aceptación real. Acceso de administradores. |

## Persistencia, permisos y límites

- Los borradores usan `action_drafts` existente. El servidor comprueba organización, cuenta y recurso con el cliente autenticado antes de insertar con el cliente backend. Sólo operadores/administradores pueden guardar o pedir propuestas de IA.
- La clave de idempotencia deriva de organización, cuenta, canal, recurso y texto sanitizado. El registro de auditoría de la tabla conserva el actor. No se añade una política de escritura de cliente.
- Editor de plan de acción y calculadora son herramientas locales. El plan puede copiarse, pero no se presenta ni se suben adjuntos desde Sentinela. Completar datos no garantiza aceptación del descargo.
- El diagnóstico por expresiones es una heurística explicada. No confirma causa raíz, sentimiento clínico, fraude ni resultado de apelaciones.
- CX usa hasta 250 líneas de venta sincronizadas para localizar ventas recientes, y hasta 1000 reclamos asociados. Los límites se muestran cuando pueden truncar la muestra; los duplicados de una venta cuentan una sola vez.
- La recuperación de filtros conserva también el canal de atención y lo separa por ruta/organización en sessionStorage. No almacena tokens o credenciales.
- La generación de IA tiene timeout, respuesta limitada y un guard local de seis propuestas por actor/organización/minuto/proceso. No es una cuota distribuida entre instancias.

## Integraciones que necesitan configuración real

1. La web necesita las variables públicas de Supabase y `SUPABASE_SECRET_KEY`, además de credenciales de la aplicación de Mercado Libre.
2. Asistencia de IA en web: `AI_PROVIDER=anthropic` o `openai`, `AI_API_KEY`; para OpenAI se exige `AI_CLASSIFIER_MODEL` explícito compatible con Chat Completions. El adaptador también valida embeddings de 1536 dimensiones y el orden de los resultados.
3. Configurar web no configura Edge Functions. El worker de clasificación existente continúa usando Anthropic. Clustering semántico requiere la producción y persistencia de embeddings; esta release no lo declara activado por agregar el adaptador.
4. Email requiere Resend, remitente verificado y secretos del worker de notificaciones. Las alertas del panel son independientes.
5. Envíos/respuestas externas, pausa de publicaciones, stock, acciones de reclamo y adjuntos conservan flags de contratos no verificados y el interruptor global. No se habilitan por cambiar la versión de la app. Ver `docs/verification-matrix.md`.
6. No se inventa una tasa de apelaciones ganadas/perdidas: el estado de un reclamo cerrado no acredita ese resultado. Tampoco se presenta un historial de infracciones sin eventos oficiales sincronizados.

## Verificación

TypeScript, lint, 191 tests de cálculos/proveedor/permisos/origen/recurso/borrador y build de producción. El build usa valores públicos de prueba; no conecta a una cuenta real. La revisión de navegador comprende 19 controles de interacción en escritorio y móvil (390/320 px), con datos de prueba y respuestas simuladas. Axe no detectó infracciones de WCAG 2 A/AA y 2.1 AA en esas vistas; esto no sustituye una auditoría completa. La ruta de prueba se retira antes del commit.

La conexión Supabase de esta sesión respondió `You do not have permission to perform this action` al intento de consulta de lectura. No se aplicó ninguna migración ni se modificó producción. El recorrido autenticado contra datos reales debe verificarse después del deploy con la conexión autorizada.

## Aceptación después del deploy

1. Conectar una cuenta, confirmar carga histórica y fechas del último recurso sincronizado.
2. Abrir preguntas y mensajes, filtrar sin perder el canal, crear un borrador y aprobarlo. Confirmar que no se envió automáticamente.
3. Revisar un reclamo con orden/envío, confirmar la evidencia, preparar un plan y validar manualmente sus hechos.
4. Abrir despachos y comparar el plazo con la fuente oficial; revisar publicación y tamaño de muestra de CX.
5. Simular un incidente sobre una venta contabilizada y sobre una nueva venta; verificar la diferencia del denominador.
6. Usar Preparación V2 para comprobar IA/email/operaciones por separado. Probar los contratos de escritura con una cuenta de prueba antes de habilitarlos.

Fuentes del adaptador OpenAI consultadas el 14 de octubre de 2026: [Chat API](https://developers.openai.com/api/reference/resources/chat) y [Embeddings API](https://developers.openai.com/api/reference/resources/embeddings/methods/create).
