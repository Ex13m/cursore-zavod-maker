# factory/

Автономное производство. Node ESM, без TypeScript, минимум зависимостей
(только archiver для zip).

## Конвейер

`trends.js → produce.js (+qa.js) → notify.js`; публикация — `publish.js`
по одобрению; чат — `chat.js` (+`imagegen.js`).

## Правила зоны

- Сид = дата. Повторный запуск дня — идемпотентный skip (`--force` пересоздаёт).
- Ошибки агентов → `alarms[]`, конвейер не падает.
- Все внешние вызовы — `fetch` с `AbortSignal.timeout`, без SDK.
- `data/` — правда завода: trends.json, drops/*.json, index.json, queue.json.
  Пишутся только через `lib/paths.js` (writeJson).
- Деградация без ключей обязательна (CLAUDE.md корня, правило 3).

## Проверка вручную

```bash
node factory/trends.js          # обновить тренды
node factory/produce.js         # дроп на сегодня
node factory/produce.js --force # пересоздать
node factory/devserver.js       # локальный API :8787
```
