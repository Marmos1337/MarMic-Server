# Домашний MarMic Server

> Статус: Stage 3 preview; требуется реальная проверка конкретной NAT topology.

MarMic Server можно установить на домашний Debian/Ubuntu `x86_64` server. До
запуска настройте статический LAN address для хоста и port forwarding:

- TCP `80` → server TCP `80` (ACME/HTTP redirect);
- TCP `443` → server TCP `443` (HTTPS/API/WebSocket);
- TCP `7881` → server TCP `7881` (LiveKit WebRTC TCP fallback);
- UDP `50000-50100` → тот же UDP range на server (LiveKit media).

Не публикуйте внутренние ports `4000` и `7880`: они доступны только в Docker
network. Разрешите те же внешние ports в host firewall. При CGNAT входящее
подключение может быть невозможно без публичного IP; TURN в Stage 3 не входит.

Installer регистрирует обнаруженный публичный IP и получает технический DNS.
Распространение записи может занимать до 10 минут. Continuous DDNS agent при
последующей смене домашнего IP остаётся задачей следующего этапа; Registry
heartbeat endpoint уже поддерживает безопасное обновление.

После установки проверьте с внешней сети HTTPS, вход в MarMic и двусторонний
voice. Локальная проверка из той же LAN может зависеть от NAT loopback роутера.
