# Pruebas end-to-end

Flujos criticos:

1. Alta de usuario, creacion de organizacion y acceso por slug.
2. Un usuario de la organizacion A no puede abrir rutas de la organizacion B.
3. Vinculacion OAuth simulada: `state` de un solo uso, callback replay rechazado.
4. Un `action_draft` no puede ejecutarse sin aprobacion humana.
5. Con el kill switch global apagado, ninguna accion de escritura se ejecuta.
