## Que cambia

<!-- Descripcion breve del cambio y su motivo. -->

## Reglas de la especificacion afectadas

<!-- Por ejemplo: OAuth, RLS, contratos MELI, gemelo de reputacion, writes aprobados. -->

## Checklist

- [ ] `npm run lint`, `npm run typecheck` y `npm test` pasan.
- [ ] `npm run build` pasa.
- [ ] Si toca el esquema: hay migracion en `supabase/migrations` (no cambios manuales en el Dashboard).
- [ ] Si agrega una tabla de negocio: tiene RLS, grants y test de aislamiento.
- [ ] Si toca un endpoint de MercadoLibre: `docs/meli-contracts.md` actualizado con URL y fecha.
- [ ] Si toca un punto NO VERIFICADO: sigue detras de capability flag y figura en `docs/verification-matrix.md`.
- [ ] Ningun token, secreto ni PII en codigo, logs o tests.
- [ ] Si toca writes a MercadoLibre: mantiene aprobacion humana y policy check previo.
