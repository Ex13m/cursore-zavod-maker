---
name: ship-queue
description: Отгрузить очередь одобренных курсоров (публикация на Gumroad или локальные бандлы). Используй когда просят «отгрузи», «опубликуй одобренное», «залей на Gumroad».
---

# Отгрузка очереди

1. Проверь очередь: `factory/data/queue.json` — есть ли items со status=queued.
2. Локальная отгрузка (dev): дерни `POST http://localhost:8787/api/publish`
   (devserver должен работать) или вызови `publishQueue()`:
   ```bash
   node -e "import('./factory/publish.js').then(m=>m.publishQueue()).then(r=>console.log(JSON.stringify(r,null,2)))"
   ```
3. Разбери результат по steps: bundle/validate/upload/enable. ok=false у
   validate → неверный productId; отсутствие GUMROAD_ACCESS_TOKEN → бандлы
   лежат в `published/<slug>/` — так и скажи владельцу.
4. Статусы в queue.json обновляются автоматически — покажи итог таблицей.
