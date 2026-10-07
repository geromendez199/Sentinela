# Experiencia de operación de Sentinela

## Cambios entregados

1. **Resumen:** panel de prioridades con cantidades reales, enlaces a reclamos por vencimiento y acciones rápidas. Los indicadores parciales siguen identificados durante la carga histórica.
2. **Carga:** skeletons en las doce secciones del panel, incluidos configuración y cuentas; animación desactivada cuando el usuario solicita menos movimiento.
3. **Sin resultados:** enlaces útiles para revisar la sincronización, quitar filtros o volver al resumen. Los registros inexistentes tienen una pantalla de recuperación.
4. **Navegación:** menú móvil accesible, cierre con Escape, breadcrumbs con vuelta a la lista y búsqueda con Ctrl/Cmd K, foco inicial y devolución del foco al cerrar.
5. **Tablas:** búsqueda local explícita, ordenamiento por encabezados, densidad cómoda/compacta, selección visible, copia con recuperación de errores y CSV con todas las columnas. Las fórmulas de planilla se neutralizan. Las fechas se ordenan por su valor ISO. La selección se reinicia al cambiar de página y conserva fallos pendientes durante la lectura en lote.
6. **Filtros:** estado, búsqueda, orden y severidad validados del lado servidor, conservados en la URL y en la paginación. Sólo estos cuatro campos se guardan en sessionStorage, por espacio y ruta. La recuperación es explícita y funciona sin almacenamiento si el navegador lo bloquea.
7. **Feedback:** avisos globales para aprobación, ejecución en cola, lectura de alertas, exportación, reconexión y reintento de trabajos. Se distinguen solicitud aceptada y ejecución final. Aviso de conexión perdida/recuperada.
8. **Sincronización/onboarding:** recorrido contextual, progreso real por tarea y actualización cada 15 segundos mientras hay trabajo pendiente, la pestaña está visible y hay conexión.
9. **Alertas:** severidad ordenada antes de paginar, filtros combinables, acceso al recurso y lectura en lote con concurrencia limitada a cinco peticiones. Los éxitos y fallos se informan por separado. Los SLA vienen del reclamo correspondiente; nunca se deducen a partir de la edad de la alerta.
10. **Lectura de datos:** niveles oficiales expresados con texto y escala monocromática, cobertura de salud sintética, márgenes respecto al umbral, distribución del riesgo y frecuencia de causas. El selector de reputación mantiene todas las consultas en la misma cuenta y organización.

## Validación

- TypeScript, ESLint y build de producción de Next.js.
- 148 tests en 24 archivos: incluyen filtros, paginación de prioridades entre grupos, CSV y prevención de fórmulas.
- 23 comprobaciones de navegador Chromium: escritorio, móvil a 390 y 320 px, foco, teclado, búsqueda, orden numérico, CSV, fallo parcial de lectura en lote, filtros guardados y conexión.
- Auditoría axe de WCAG 2 A/AA y 2.1 AA, sin infracciones detectadas en las vistas de prueba de escritorio y móvil.
- Consultas de lectura en Supabase para comprobar campos y orden de severidad/vencimiento. No se modifica el esquema ni las políticas.

La revisión de navegador usa una vista local temporal con datos de prueba y respuestas simuladas. Esa ruta se retira antes del commit; no forma parte del deploy. La auditoría automática no sustituye una evaluación completa de accesibilidad ni un recorrido autenticado con datos reales después del deploy.

## Verificación después del deploy

1. Abrir el resumen con una cuenta conectada y, si está cargando, comprobar que el avance cambia sin recargar manualmente.
2. Entrar en órdenes/reclamos/publicaciones, aplicar filtros y navegar a otra página. Volver a la lista, recuperar los filtros y comprobar el CSV.
3. Seleccionar alertas abiertas y marcarlas como vistas; comprobar que el estado coincide después de actualizar.
4. Si hay varias cuentas, alternar el selector de reputación y comprobar que las fechas y señales pertenecen a la cuenta elegida.
5. Revisar el menú móvil, el recorrido de teclado y las pantallas sin resultados en un espacio vacío.
