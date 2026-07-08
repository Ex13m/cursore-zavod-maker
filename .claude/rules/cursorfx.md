---
paths:
  - "packages/cursorfx/**"
---

# Правила зоны packages/cursorfx/

- Ядро без зависимостей; React — только в src/react (peer, optional).
- Эффект = класс с init/update/destroy + сериализуемые options (plain JSON).
- Нет аллокаций в update() — 60 fps обязательны.
- Новый эффект: класс → реестр в effects/index.ts → EffectType → поля в
  portal (schema) → архетип в factory/archetypes.js → правило qa при нужде.
