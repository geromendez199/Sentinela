# Pruebas de carga y caos

Objetivos que estas pruebas deben verificar (seccion 13 de la especificacion):

- ACK de webhook p95 < 250 ms y p99 < 450 ms bajo carga sintetica.
- 100 refrescos concurrentes producen un unico `POST /oauth/token`.
- Los workers toleran duplicados y desorden sin duplicar efectos.
- Bajo 429 sostenido, el sistema degrada frecuencia sin abandonar checkpoints.

El escenario de webhooks se ejecuta contra un entorno de staging con cuentas de
prueba; nunca contra produccion ni contra cuentas reales de vendedores.
