---
paths:
  - "factory/**"
---

# Правила зоны factory/

- Детерминизм: сид = дата. Запрещены `Math.random()`, `Date.now()` в генерации
  (только через lib/seed.js и явную дату).
- Ошибки агентов не валят конвейер: копи в `alarms[]`, возвращай результат.
- Внешние вызовы — только `fetch` + `AbortSignal.timeout`, без SDK.
- В `data/` пиши только через `lib/paths.js#writeJson`.
- Любой модуль обязан работать без API-ключей (graceful degradation).
