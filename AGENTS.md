# Агенты завода

Реестр специализированных агентов Cursor Zavod. Каждый агент имеет свой промпт в
`.claude/agents/`, работает в своей зоне и передаёт результат дальше по конвейеру.

| Агент | Зона | Вход | Выход | Запуск |
|---|---|---|---|---|
| **trend-scout** | `factory/trends.js` | внешние сигналы, банк трендов | `factory/data/trends.json` | cron 07:00 UTC / вручную |
| **producer** | `factory/produce.js` | trends.json, дата | `factory/data/drops/YYYY-MM-DD.json` | после trend-scout |
| **qa-inspector** | `factory/qa.js` | дроп дня | `alarms[]` внутри дропа | в конвейере produce |
| **publisher** | `factory/publish.js` | queue.json (одобренное) | zip+cover → Gumroad / `published/` | по одобрению владельца |
| **notifier** | `factory/notify.js` | дата дропа | email (Resend) / лог | конец конвейера |

## Конвейер

```
cron ──▶ trend-scout ──▶ producer ──▶ qa-inspector ──▶ commit+deploy ──▶ notifier
                                                             │
владелец на пульте: тест → галочка ──▶ publisher ──▶ Gumroad │
```

## Правила для агентов

- Агент пишет только в свою зону `factory/data/`; чужие файлы — read-only.
- Любая ошибка агента — тревога (`alarms[]`), а не падение конвейера: следующий
  агент запускается всегда.
- Агенты не требуют ключей: деградация описана в CLAUDE.md, правило 3.
- Субагентам Claude Code: свои промпты в `.claude/agents/*.md`, скилы конвейера
  в `.claude/skills/`.
