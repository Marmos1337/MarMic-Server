# Сетевые порты и reverse proxy MarMic Server

| Протокол | Порт | Назначение |
| --- | ---: | --- |
| TCP | 80 | Bundled Caddy: ACME HTTP challenge/redirect (только если свободен) |
| TCP | 443 | Bundled Caddy: HTTPS, API и WebSocket (только если свободен) |
| TCP | 7881 | LiveKit WebRTC TCP fallback |
| UDP | 50000-50100 | LiveKit WebRTC media |

Внутренние порты MarMic Server `4000/tcp`, LiveKit signalling `7880/tcp` и
external-proxy listener (обычно `127.0.0.1:44080`) наружу открывать не нужно.

## Существующий Nginx/Caddy/Traefik

Installer сначала проверяет host `80/443`. Если любой из них занят, он не
останавливает процесс и не меняет его конфигурацию. Bundled Caddy получает
loopback-порты, а snippets сохраняются в `/etc/marmic/proxy/`.

Для `<slug>.srv.mic.marhub.ru` направьте существующий HTTPS virtual host на
`http://127.0.0.1:<MARMIC_PROXY_UPSTREAM_PORT>`:

### Nginx

Подключите `/etc/marmic/proxy/nginx.conf` внутрь нужного `server {}`. В snippet
уже есть `proxy_http_version 1.1`, Upgrade/Connection и долгий timeout для WSS.

### Caddy

Добавьте содержимое `/etc/marmic/proxy/caddy.conf` в Caddyfile и выполните
обычный `caddy reload`.

### Traefik

Загрузите `/etc/marmic/proxy/traefik.conf` как dynamic file provider. TLS
остаётся у вашего entrypoint `websecure`, HTTP backend — loopback MarMic.

После подключения проверьте:

```bash
sudo marmic doctor
curl --fail https://<slug>.srv.mic.marhub.ru/health
```

## VPS

Откройте внешние порты в firewall ОС и в cloud firewall/security group провайдера, если он есть.

## Домашний сервер

Настройте port forwarding тех же портов с роутера на постоянный LAN-IP MarMic Server.

## TURN

В опубликованном `v0.16.18` отдельные TURN ports отсутствуют. Не открывайте их,
пока установленный artifact не сообщает поддержку TURN.

Для следующего runtime подготовлены:

| Протокол | Порт | Назначение |
| --- | ---: | --- |
| UDP | 3478 | встроенный authenticated TURN listener |
| UDP | 50101-50200 | bounded TURN relay allocations |

TURN/TLS `443/tcp` не добавляется в обычный single-node Compose: этот порт уже
принадлежит Caddy. Вариант TURN/TLS требует L4 SNI edge или отдельного public IP
и описан в [turn.md](turn.md).
