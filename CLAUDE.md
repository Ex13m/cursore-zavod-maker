# CURSOR ZAVOD

Автономный завод анимированных курсоров: тренды → производство → пульт HMI →
одобрение владельцем → публикация на Gumroad. Источник истины — `docs/SPEC.md`.

## Структура

- `packages/cursorfx/` — библиотека эффектов (TypeScript, 0 зависимостей). Свой CLAUDE.md.
- `factory/` — производство (Node, ESM): trends → produce → qa → publish → notify. Свой CLAUDE.md.
- `portal/` — HMI-пульт (Vite + vanilla TS). Свой CLAUDE.md.
- `factory/data/` — состояние завода (JSON, коммитится: git = БД и журнал аудита).
- `docs/` — спека, PDF, ADR. `.claude/` — rules, skills, agents, workflows, hooks.

## Команды (проверены)

```bash
npm install                # корень, устанавливает workspaces
npm run dev                # портал :5173 (+ прокси API)
npm run build              # библиотека + портал
npm run typecheck          # tsc --noEmit по всем пакетам
npm run factory:daily      # полный суточный цикл вручную
node factory/produce.js    # только произвести дроп на сегодня
node factory/trends.js     # только обновить trends.json
```

## Правила

1. **Спека первична.** Меняешь поведение — сначала ADR в `docs/adr/`, потом код.
2. **Секреты — только `{ENV_VAR}`.** Никогда не хардкодь ключи: репозиторий ПУБЛИЧНЫЙ.
   Локально `.env` (gitignored), в CI — GitHub Secrets, на Netlify — env vars.
   Ключи: `ANTHROPIC_API_KEY`, `REPLICATE_API_TOKEN`, `RESEND_API_KEY`,
   `GUMROAD_ACCESS_TOKEN`.
3. **Graceful degradation.** Любая функция обязана работать без внешних ключей
   (эвристический парсер, SVG вместо AI-картинок, лог вместо письма, бандл вместо Gumroad).
4. **Детерминизм производства.** Сид генератора = дата (`YYYY-MM-DD`). Один день —
   один и тот же дроп. Никаких `Math.random()` без сида в factory/.
5. **Git = БД.** Каждый дроп/публикация — отдельный commit с понятным сообщением
   (`factory: drop 2026-07-08`, `publish: 3 items`). Не переписывай историю factory/data.
6. **HMI-дизайн.** Цвет только у статусов: RUN `#2ecc71`, QUEUED `#f39c12`,
   ALARM `#e74c3c`, INFO `#3498db`. Фон графит `#1a1d21`. Декоративной анимации нет —
   анимируются только сами курсоры.
7. **Эффекты сериализуемы.** Курсор = `EffectSpec[]` (plain JSON). Новый эффект:
   класс в `packages/cursorfx/src/effects/` + регистрация в реестре + поля в
   `portal/src/effectSchema.ts` + архетип в `factory/archetypes.js`.
8. **Не трогай** `docs/CURSOR-ZAVOD-SPEC.pdf` и `me/` — это артефакты инициирования.

## Агенты

Реестр и роли — в `AGENTS.md`. Path-gated правила — в `.claude/rules/`.

## Definition of Done

- `npm run typecheck` и `npm run build` зелёные.
- Производственный цикл идемпотентен (повторный запуск дня не дублирует дроп).
- Новые функции деградируют без ключей.

---
Глобальные правила системы: см. KAIROS-RULES.md
---