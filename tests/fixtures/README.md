# Fixtures

Respuestas sanitizadas de MercadoLibre usadas por los contract tests de parsing.

Reglas:

- Sin datos personales de compradores reales: nombres, direcciones, documentos,
  telefonos y emails se reemplazan por valores sinteticos.
- Sin tokens ni identificadores de aplicacion reales.
- Cada fixture indica el endpoint, la fecha de captura y el sitio.
