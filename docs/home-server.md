# Домашний MarMic Server

MarMic Server можно запускать дома на Debian 12/Ubuntu 24.04 `x86_64/amd64`.

## Что требуется

- Linux-сервер с Docker;
- постоянный LAN-IP или DHCP reservation;
- публичный IPv4 от провайдера;
- доступ к настройкам роутера;
- возможность открыть firewall ports.

Если провайдер использует CGNAT, обычный входящий доступ может быть невозможен. TURN пока не входит в текущую сборку.

## 1. Закрепите LAN-IP

Сделайте DHCP reservation на роутере, чтобы сервер не получал новый локальный IP после перезагрузки.

## 2. Port forwarding

| Протокол | Внешний порт | Внутренний порт | Назначение |
| --- | ---: | ---: | --- |
| TCP | 80 | 80 | ACME / HTTP redirect |
| TCP | 443 | 443 | HTTPS, API, WebSocket (если нет внешнего proxy) |
| TCP | 7881 | 7881 | LiveKit WebRTC TCP fallback |
| UDP | 50000-50100 | 50000-50100 | LiveKit WebRTC media |

Не открывайте наружу TCP `4000` и `7880`.

## 3. Host firewall

Разрешите те же входящие порты в firewall Linux-сервера. Если используете `ufw` или другую policy, не заменяйте существующие правила наугад.

## 4. Установка

```bash
sh -c 'set -eu; tmp="$(mktemp "${TMPDIR:-/tmp}/marmic-install.XXXXXX")"; trap "status=\$?; trap - EXIT HUP INT TERM; rm -f \"\$tmp\"; exit \$status" EXIT; trap "exit 129" HUP; trap "exit 130" INT; trap "exit 143" TERM; if ! curl --fail --show-error --location --retry 4 --retry-all-errors --retry-delay 2 --retry-max-time 120 --connect-timeout 15 --max-time 1200 https://mic.marhub.ru/install.sh --output "$tmp"; then echo "Не удалось полностью скачать MarMic Server installer." >&2; exit 1; fi; if [ ! -s "$tmp" ]; then echo "Загружен пустой MarMic Server installer." >&2; exit 1; fi; sudo sh "$tmp"'

```

Installer получает адрес `xxxxxxxxxxxxxxxxxxxx.srv.mic.marhub.ru`. DNS propagation может занимать **до 10 минут. Это нормально**.

Если 443 уже занят Nginx/Caddy/Traefik, installer оставляет существующий
proxy нетронутым, поднимает MarMic на loopback high port и сохраняет snippets в
`/etc/marmic/proxy/`. Подключите snippet к своему proxy и повторите `sudo marmic doctor`.

## 5. Проверка из внешней сети

Проверяйте сервер через мобильный интернет или другую внешнюю сеть. Часть роутеров не поддерживает NAT loopback/hairpin NAT, поэтому публичный адрес может не работать из той же LAN, хотя извне всё исправно.

## 6. Voice

Для voice нужны UDP `50000-50100` и TCP `7881` fallback. Если HTTPS/text работают, а voice нет, сначала проверьте UDP port forwarding и firewall.

## 7. Динамический внешний IP

Registry выполняет безопасный DDNS update по authenticated heartbeat сервера.

## 8. CGNAT

Признаки CGNAT: WAN IP роутера отличается от публичного IP или port forwarding настроен, но входящие соединения не доходят. Для `v0.16.17` запросите у провайдера публичный IPv4; TURN в этом runtime не входит. Отдельная relay-схема описана в [turn.md](turn.md).
