# 🏭 CURSOR ZAVOD

**Автономный завод анимированных курсоров.** Каждое утро завод сам анализирует
тренды, выпускает партию из 10 курсоров и присылает письмо со ссылкой на пульт.
Владелец тестирует вживую, ставит галочки — одобренное пакуется и уходит на
Gumroad. Ручной режим — чат «Цех»: опиши курсор словами, завод соберёт.

> Спека: [docs/SPEC.md](docs/SPEC.md) · PDF: [docs/CURSOR-ZAVOD-SPEC.pdf](docs/CURSOR-ZAVOD-SPEC.pdf)

## Быстрый старт

```bash
npm install
cp .env.example .env        # ключи опциональны — всё работает и без них
npm run factory:daily       # выпустить дроп на сегодня (тренды → 10 курсоров → письмо/лог)
npm run dev                 # пульт http://localhost:5173 + api :8787
```

## Суточный цикл (автопилот)

```
07:00 UTC  GitHub Actions: trends → produce → ОТК → commit (git = журнал)
07:05      Netlify автодеплой портала (дроп уже внутри)
07:06      письмо владельцу (Resend) со ссылкой на пульт
днём       владелец: ТЕСТ → ОДОБРИТЬ → ▶ ОТГРУЗИТЬ → Gumroad
```

## Пульт (Factory HMI)

| Экран | Что делает |
|---|---|
| ПУЛЬТ | датчики трендов, тревоги ОТК, счётчики смены |
| КОНВЕЙЕР | дроп дня: live-тест, цена, галочка «одобрить», отгрузка |
| ЦЕХ-ЧАТ | курсор по текстовому промпту (+FLUX-спрайт при ключе Replicate) |
| СКЛАД | все прошлые дропы |
| ПРОДАЖИ | очередь и статусы отгрузок, ссылки Gumroad |

## Монорепо

```
packages/cursorfx/   библиотека эффектов (0 зависимостей, ESM+CJS+d.ts)
factory/             производство: trends · produce · qa · chat · imagegen · publish · notify
portal/              HMI-пульт (Vite, vanilla TS, ≤100 KB)
netlify/functions/   serverless-двойники API (queue в Netlify Blobs)
.claude/             rules · agents · skills · workflows · hooks (Final Boss Structure)
```

## Ключи (все опциональны)

| Env | Даёт | Без него |
|---|---|---|
| `GUMROAD_ACCESS_TOKEN` | автопубликация в draft-товары | бандл в `published/` |
| `ANTHROPIC_API_KEY` | AI-инженер в чате | эвристический парсер |
| `REPLICATE_API_TOKEN` | FLUX-спрайты для image-курсоров | эмодзи/SVG |
| `RESEND_API_KEY` + `EMAIL_TO/FROM` | утреннее письмо | ссылка в лог |

Секреты: локально `.env`, в CI — GitHub Secrets, на Netlify — env vars.
Репозиторий публичный — ключей в коде быть не может (hook-страж в `.claude/hooks/`).

## Gumroad: важное ограничение

Публичный API Gumroad **не создаёт товары** ([antiwork/gumroad#4019](https://github.com/antiwork/gumroad/issues/4019)).
Создай черновики руками один раз, вставь их product ID в карточки на конвейере —
завод зальёт файл и опубликует сам.

---

MIT © Ex13m · построено по [docs/SPEC.md](docs/SPEC.md) при участии Claude
