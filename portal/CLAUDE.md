# portal/

HMI-пульт завода. Vite + vanilla TS, без фреймворка (< 100 KB JS).

## Правила зоны

- Дизайн-система — только токены из `src/style.css` (:root). Цвет = статус.
  Ничего декоративного не анимировать: движется только сам курсор.
- Данные: дропы/тренды — статикой из `/data/**` (в dev проксируется на
  devserver, в проде копируются при сборке). Действия — через `/api/**`
  (dev: factory/devserver.js; прод: netlify/functions).
- `cursorfx` импортируется из исходников через alias (vite.config.ts).
- Пять экранов: board (пульт), conveyor (дроп+одобрение), chat (цех),
  warehouse (архив), sales (отгрузки). Новый экран = функция view* + пункт nav.

## Команды

```bash
npm run dev -w portal        # :5173 (нужен dev:api на :8787)
npm run build -w portal
npm run typecheck -w portal
```
