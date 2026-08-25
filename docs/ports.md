# Сетевые порты MarMic Server

| Протокол | Порт | Назначение |
| --- | ---: | --- |
| TCP | 80 | Caddy: ACME HTTP challenge и redirect на HTTPS |
| TCP | 443 | Caddy: HTTPS, API и WebSocket reverse proxy |
| TCP | 7881 | LiveKit WebRTC TCP fallback |
| UDP | 50000-50100 | LiveKit WebRTC media |

Внутренние порты MarMic Server `4000/tcp` и LiveKit signalling `7880/tcp` наружу открывать не нужно.

## VPS

Откройте внешние порты в firewall ОС и в cloud firewall/security group провайдера, если он есть.

## Домашний сервер

Настройте port forwarding тех же портов с роутера на постоянный LAN-IP MarMic Server.

## TURN

В опубликованном `v0.15.0` отдельные TURN ports отсутствуют. Не открывайте их,
пока установленный artifact не сообщает поддержку TURN.

Для следующего runtime подготовлены:

| Протокол | Порт | Назначение |
| --- | ---: | --- |
| UDP | 3478 | встроенный authenticated TURN listener |
| UDP | 50101-50200 | bounded TURN relay allocations |

TURN/TLS `443/tcp` не добавляется в обычный single-node Compose: этот порт уже
принадлежит Caddy. Вариант TURN/TLS требует L4 SNI edge или отдельного public IP
и описан в [turn.md](turn.md).
