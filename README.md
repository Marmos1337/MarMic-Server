# MarMic Server

MarMic Server — self-hosted сервер для MarMic. Он запускается на вашей Linux-машине, а пользователи подключаются к нему через MarMic Desktop или Web.

Подходящие сценарии:
- VPS с публичным IPv4;
- домашний Linux-сервер с публичным IPv4 и настроенным port forwarding.

MarMic Server является проприетарным ПО. Публичный репозиторий содержит документацию и обозримый bootstrap installer; исходный код server runtime здесь не публикуется.

## Быстрый старт — Preview

Текущий проверенный preview: `v0.12.4-stage4a.2`, Linux `x86_64/amd64`.

Перед установкой нужны:
- Debian 12 или Ubuntu 24.04;
- root/sudo;
- Docker Engine;
- Docker Compose plugin;
- публичный IPv4;
- открытые сетевые порты.

Проверка Docker:

```bash
docker version
docker compose version
```

Если Docker ещё не установлен, установите Docker Engine и Compose plugin по официальной инструкции Docker для вашей системы.

Откройте:
- TCP `80`;
- TCP `443`;
- TCP `7881`;
- UDP `50000-50100`.

Подробнее: [сетевые порты](docs/ports.md).

### Установка Preview

```bash
curl -fsSL https://raw.githubusercontent.com/Marmos1337/MarMic-Server/main/install.sh \
  | sudo env \
      MARMIC_REGISTRY_URL=https://hub.marmos.udav.team \
      MARMIC_IDENTITY_URL=https://hub.marmos.udav.team \
      sh
```

Bootstrap:
1. скачивает официальный proprietary artifact;
2. проверяет закреплённый SHA-256;
3. проверяет Linux/amd64 и Docker;
4. создаёт локальную Ed25519 identity сервера;
5. регистрирует сервер в MarMic Registry;
6. получает адрес вида `xxxxxxxx.srv.marmic.udav.team`;
7. ждёт DNS;
8. запускает MarMic Server, LiveKit и Caddy;
9. настраивает HTTPS;
10. выводит одноразовый Owner Token.

DNS после регистрации может распространяться **до 10 минут. Это нормально**. Не удаляйте сервер и не запускайте установку с нуля только потому, что адрес появился не мгновенно.

После установки сохраните Owner Token и откройте сервер в MarMic Desktop или Web. Если сервер ещё не claimed, MarMic предложит ввести Owner Token. Первый успешно прошедший claim пользователь становится владельцем сервера.

Owner Token:
- действует 24 часа;
- одноразовый;
- не хранится на Hub в plaintext;
- после успешного claim повторно не используется.

До claim новый token можно получить:

```bash
sudo marmic owner-token regenerate
```

## После установки

```bash
sudo marmic status
sudo marmic doctor
sudo marmic version
sudo marmic logs
sudo marmic restart
```

Данные:
- `/opt/marmic` — runtime;
- `/etc/marmic` — конфигурация;
- `/var/lib/marmic` — DB, uploads, Registry identity и persistent state;
- `/var/backups/marmic` — каталог будущих официальных backups.

Повторный запуск installer не должен создавать новый `server_id` и не должен уничтожать `/var/lib/marmic`.

## Домашний сервер

Для домашней установки нужен публичный IPv4. На роутере закрепите постоянный LAN-IP за Linux-сервером и настройте port forwarding:
- TCP `80` → сервер `80`;
- TCP `443` → сервер `443`;
- TCP `7881` → сервер `7881`;
- UDP `50000-50100` → тот же диапазон на сервер.

TCP `4000` и `7880` наружу открывать не нужно.

Если провайдер использует CGNAT и у вас нет входящего публичного IPv4, этот preview может быть недоступен извне. TURN пока не входит в текущую сборку.

Подробнее: [домашний сервер](docs/home-server.md).

## Текущий статус Preview

Production MarMic Hub Registry и Beget DNS provisioning уже развёрнуты и проверены. Artifact `v0.12.4-stage4a.2` прошёл локальный extracted-install и полный Compose smoke: MarMic Server + LiveKit + Caddy, а server identity сохранялась после recreate.

Что ещё остаётся до снятия Preview:
- реальный end-to-end smoke на отдельной внешней/изолированной Linux-машине;
- проверка ACME/HTTPS в реальной сети;
- проверка двух клиентов, text chat и voice;
- continuous DDNS heartbeat agent;
- официальный update agent;
- официальный backup/restore CLI;
- arm64;
- TURN.

Пока внешний smoke не закрыт, installer намеренно требует явные `MARMIC_REGISTRY_URL` и `MARMIC_IDENTITY_URL`. После успешного smoke официальный bootstrap будет упрощён до обычной one-command установки.

## Документация

- [Полная установка](docs/installation.md)
- [Домашний сервер](docs/home-server.md)
- [Сетевые порты](docs/ports.md)
- [Устранение неполадок](docs/troubleshooting.md)
- [Обновления](docs/updating.md)
- [Резервные копии](docs/backups.md)

## Лицензирование

- Некоммерческое использование Community Server бесплатно.
- Количество некоммерческих Community Servers не ограничено.
- Коммерческое использование — только по отдельному соглашению с правообладателем.
- Runtime остаётся proprietary и не становится open source из-за публичной загрузки binary artifact.

Документы:
- [MarMic Server Community License](LICENSE.md)
- [Commercial use](COMMERCIAL.md)
- [Privacy & Telemetry Policy](PRIVACY.md)
- [Security Policy](SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
