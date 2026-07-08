# packages/cursorfx

Библиотека эффектов. Ядро без зависимостей; React — опциональные обёртки.

## Инварианты

- `src/core/` не знает про эффекты; эффекты не знают друг про друга.
- Каждый эффект реализует `CursorEffect` (init/update/destroy) и обязан быть
  сериализуемым: конструктор принимает plain-object options.
- Новый эффект регистрируется в `src/effects/index.ts` (тип + REGISTRY).
- В `update()` не аллоцировать: мутируй поля, переиспользуй объекты (60 fps).
- Публичный API — только через `src/index.ts`.

## Команды

```bash
npm run build -w packages/cursorfx     # tsup → dist (esm+cjs+d.ts)
npm run typecheck -w packages/cursorfx
```
