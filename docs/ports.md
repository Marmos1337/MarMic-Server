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

Отдельные TURN ports сейчас отсутствуют: TURN пока не входит в текущий release.
