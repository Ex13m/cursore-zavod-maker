#!/bin/sh
# PreToolUse guard: блокирует Write/Edit, если в контенте похоже на секрет.
# Репозиторий ПУБЛИЧНЫЙ — утечка ключа фатальна.
input=$(cat)
if printf '%s' "$input" | grep -qE '(sk-ant-[a-zA-Z0-9_-]{20,}|r8_[a-zA-Z0-9]{20,}|re_[a-zA-Z0-9]{20,}|access_token=[a-zA-Z0-9]{20,})'; then
  echo '{"decision":"block","reason":"Похоже на API-ключ в содержимом файла. Секреты — только в .env (gitignored) или GitHub/Netlify Secrets."}'
  exit 0
fi
exit 0
