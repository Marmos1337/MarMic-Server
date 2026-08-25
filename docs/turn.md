# TURN и relay

## Статус release

Опубликованный MarMic Server `v0.15.0` ещё не содержит TURN. Его рабочие media
ports — TCP `7881` и UDP `50000-50100`. Не открывайте дополнительные порты,
пока `sudo marmic version` не покажет release с TURN, а `sudo marmic doctor` —
отдельную успешную проверку `TURN/UDP`.

В следующем server distribution подготовлен встроенный TURN LiveKit для
одноузловой self-hosted установки. Это часть MarMic Server, а не отдельный
пользовательский продукт и не обязательный MarMic cloud relay.

## Порядок сетевых путей

Клиент и LiveKit выбирают путь через ICE:

1. direct UDP — `50000-50100/udp`;
2. direct encrypted ICE/TCP — `7881/tcp`, если UDP недоступен;
3. embedded TURN/UDP — listener `3478/udp` и relay allocations
   `50101-50200/udp`.

TURN не форсируется для нормальных соединений и не ухудшает direct path. В
Desktop voice diagnostics `candidateType=relay` означает TURN; `host`, `srflx`
или `prflx` означают direct ICE. IP-адреса кандидатов в диагностический payload
не включаются.

## Аутентификация

Embedded TURN использует те же LiveKit API keys и выдаёт подключённому
participant временные credentials с TTL 300 секунд. Статического публичного
username/password нет. Неверный credential и новая allocation с истёкшим
credential отклоняются LiveKit.

## Почему TURN/TLS не занимает 443 автоматически

В single-node Compose TCP `443` уже принадлежит Caddy для HTTPS/WSS. Два
процесса не могут безопасно слушать один IP/port, а обычный HTTP reverse proxy
не маршрутизирует TURN/TLS.

Для сети, пропускающей только TLS на `443/tcp`, нужен один из вариантов:

- отдельный public IP для TURN/TLS;
- L4 SNI edge, который завершает TLS и направляет TURN hostname в LiveKit или
  coturn, а HTTPS hostname — в Caddy/Nginx Proxy Manager;
- внешний доверенный TURN service с dynamic shared-secret credentials.

Такой edge обязан иметь валидный certificate для TURN hostname и отдельный
секрет с ограниченным доступом. Installer не меняет существующий Nginx Proxy
Manager, firewall или router автоматически.

## Ограничение CGNAT

Embedded TURN находится на той же машине, что и SFU. Он помогает клиентам из
ограниченных Wi-Fi/corporate/mobile сетей, но не делает недоступный за CGNAT
домашний сервер публичным: listener и relay range всё равно должны быть
достижимы извне. Для CGNAT нужен публичный VPS/relay edge, публичный IPv4 от
провайдера или поддерживаемый туннель с UDP/L4 forwarding.

## Acceptance после публикации artifact

На isolated Linux host требуется проверить:

- direct voice при доступном UDP;
- forced relay при заблокированном direct UDP;
- reconnect через relay;
- отклонение неверных и истёкших credentials;
- отсутствие открытой relay allocation без authenticated participant;
- одновременные voice/camera/screen-share и возврат к direct path;
- `sudo marmic doctor`, где `TURN/UDP` отображается отдельно.

До выполнения этой проверки через реальный внешний NAT TURN следует считать
реализованным в distribution source, но не production-accepted.
