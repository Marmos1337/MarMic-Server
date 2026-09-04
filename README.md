# MarMic Server

Официальный сайт MarMic: [https://mic.marhub.ru/](https://mic.marhub.ru/)

MarMic Server — self-hosted сервер для MarMic. Он запускается на вашей Linux-машине, а пользователи подключаются к нему через MarMic Desktop или Web.

Подходящие сценарии:

- VPS с публичным IPv4;
- домашний Linux-сервер с публичным IPv4 и настроенным port forwarding.

MarMic Server является проприетарным ПО. Публичный репозиторий содержит документацию и обозримый bootstrap installer; исходный код server runtime здесь не публикуется.

## Быстрый старт

Подготовлен Server **`v0.18.0`**, Linux `x86_64/amd64`. Это локальный release
candidate; публичная публикация ещё не подтверждена. Последний опубликованный
release на момент подготовки — `v0.16.21`. Bootstrap в этой ревизии закреплён
за финальным архивом `0.18.0`; не запускайте его до появления официального
GitHub Release с соответствующими файлами.

### 0.18.0: данные и обновления — Русский

- Новые установки по умолчанию используют отдельный управляемый PostgreSQL 17.
  Self-host данные остаются у владельца, отдельно от Global Identity.
- Существующий SQLite Server не переустанавливается и не мигрирует молча.
  Bootstrap обновляет management tooling, сохраняя работающий runtime/provider.
  Переход требует `approval_required`: согласие владельца, проверка ресурсов,
  полный backup, import/validation и health до открытия записи.
- Сохраняются `serverId`, owner, memberships, роли, сообщения, uploads и private
  Server identity key. Исходная SQLite остаётся rollback snapshot. После новых
  PostgreSQL writes автоматический откат на старую SQLite не допускается.
- Новые updater manifests проверяются Ed25519: подпись, ключ, версия, срок,
  канал/архитектура, SHA-256 и размер. Неизвестная/невалидная подпись и downgrade
  отклоняются. Приватные release keys не входят в публичный репозиторий/архив.
- Legacy unsigned feed остаётся побайтно на `0.16.21`, а не предлагает скрытую
  миграцию. Owner dialog для старого API требует установленного management
  bridge и proxy route; одна публикация release не доказывает доставку окна.
- Подготовленный archive SHA-256:
  `d338164ac34f0da36f23996785a337b08e225eb65a1fd33ac740bbc24405594c`.
  Bootstrap SHA-256:
  `d12f269fdbeb10f5a88aaa7ab6699b837bf529a34e846c5d6403e5504f462625`.
  Linux/amd64 runtime, `.sha256`, signed companion, frozen legacy metadata и
  `install.sh` должны публиковаться вместе. Production/owner-window acceptance
  и публичные downloads на этом checkpoint не объявляются PASS.

### 0.18.0: data and updates — English

- New installations default to a dedicated managed PostgreSQL 17 instance.
  Self-host data stays with its owner, separate from Global Identity.
- Existing SQLite Servers are neither reinstalled nor silently migrated.
  Bootstrap updates management tooling while retaining the running runtime and
  provider. Transition requires `approval_required`: owner consent, resource
  preflight, full backup, import/validation and health before admitting writes.
- `serverId`, owner, memberships, roles, messages, uploads and the private Server
  identity key are preserved. Source SQLite remains a rollback snapshot. After
  new PostgreSQL writes, automatic rollback to old SQLite is not permitted.
- New updater manifests require Ed25519 verification: signature, key, version,
  expiry, channel/architecture, SHA-256 and size. Unknown/invalid signatures and
  downgrades are rejected. Private release keys are not in the public repo/archive.
- The legacy unsigned feed stays byte-identical at `0.16.21`, rather than offering
  a silent migration. Old-API owner dialogs require an installed management
  bridge and proxy route; publishing a release alone does not prove delivery.
- Prepared archive SHA-256:
  `d338164ac34f0da36f23996785a337b08e225eb65a1fd33ac740bbc24405594c`.
  Bootstrap SHA-256:
  `d12f269fdbeb10f5a88aaa7ab6699b837bf529a34e846c5d6403e5504f462625`.
  Linux/amd64 runtime, `.sha256`, signed companion, frozen legacy metadata and
  `install.sh` must be published together. Production/owner-dialog acceptance
  and public downloads are not claimed PASS at this checkpoint.

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

Если TCP `80` или `443` уже заняты reverse proxy, installer не останавливает
его, а использует loopback high ports и пишет готовые snippets в
`/etc/marmic/proxy/`.

Подробнее: [сетевые порты](docs/ports.md).

### Установка

```bash
sh -c 'set -eu; tmp="$(mktemp "${TMPDIR:-/tmp}/marmic-install.XXXXXX")"; trap "status=\$?; trap - EXIT HUP INT TERM; rm -f \"\$tmp\"; exit \$status" EXIT; trap "exit 129" HUP; trap "exit 130" INT; trap "exit 143" TERM; if ! curl --fail --show-error --location --retry 4 --retry-all-errors --retry-delay 2 --retry-max-time 120 --connect-timeout 15 --max-time 1200 https://mic.marhub.ru/install.sh --output "$tmp"; then echo "Не удалось полностью скачать MarMic Server installer." >&2; exit 1; fi; if [ ! -s "$tmp" ]; then echo "Загружен пустой MarMic Server installer." >&2; exit 1; fi; sudo sh "$tmp"'
```

Команда сначала целиком скачивает bootstrap во временный файл и только затем
запускает его. Ошибка сети, пустой/частичный download или ошибка installer
возвращают non-zero; временный файл удаляется автоматически.

Bootstrap:

1. скачивает официальный proprietary artifact;
2. проверяет закреплённый SHA-256;
3. проверяет Linux/amd64 и Docker;
4. создаёт локальную Ed25519 identity сервера;
5. регистрирует сервер в MarMic Registry;
6. получает адрес вида `xxxxxxxxxxxxxxxxxxxx.srv.mic.marhub.ru`;
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
sudo marmic update check
sudo marmic update status
sudo marmic update
```

Данные:

- `/opt/marmic` — runtime;
- `/etc/marmic` — конфигурация;
- `/var/lib/marmic` — DB, uploads, Registry identity и persistent state;
- `/var/backups/marmic` — known-good backups, создаваемые updater перед
  активацией нового runtime.

Повторный запуск installer не должен создавать новый `server_id` и не должен уничтожать `/var/lib/marmic`.

## Домашний сервер

Для домашней установки нужен публичный IPv4. На роутере закрепите постоянный LAN-IP за Linux-сервером и настройте port forwarding:

- TCP `80` → сервер `80`;
- TCP `443` → сервер `443`;
- TCP `7881` → сервер `7881`;
- UDP `50000-50100` → тот же диапазон на сервер.

TCP `4000` и `7880` наружу открывать не нужно.

Если провайдер использует CGNAT и у вас нет входящего публичного IPv4, сервер может быть недоступен извне. TURN пока не входит в текущую сборку.

Подробнее: [домашний сервер](docs/home-server.md).

## Исторический контекст до 0.18.0

В `v0.16.19` входят canonical self-host DNS
(`<slug>.srv.mic.marhub.ru`), безопасный
preflight занятых 80/443, loopback-порты для существующего reverse proxy,
готовые Nginx/Caddy/Traefik snippets и проверяемый runtime bootstrap. Bootstrap
сохраняет disk-backed staging в `/var/tmp`, проверку SHA-256 и безопасных путей.
Также исправлено восстановление DNS для уже зарегистрированных серверов: повторный
запуск installer и перезапуск Hub автоматически продолжают зависшую запись в статусе
`reserved`, не меняя `server_id` и hostname.

Исторический disposable-VPS flow, ACME/HTTPS, Owner Claim и подключение второго
аккаунта ранее были проверены и используются только как regression context.
Того VPS больше нет; production не используется вместо destructive test host.
Новые uninstall/purge и другие разрушительные проверки требуют отдельной
isolated Linux VM или специально созданного disposable host. В `0.13.0`
добавлен официальный update agent с backup, health-check и rollback; после
здоровой первой установки systemd timer включается автоматически. В следующих
версиях остаются:

- официальный backup/restore CLI;
- arm64;
- публикация уже подготовленного embedded TURN/UDP runtime и внешний
  acceptance-test relay allocation.

## Документация

- [Полная установка](docs/installation.md)
- [Домашний сервер](docs/home-server.md)
- [Сетевые порты](docs/ports.md)
- [Устранение неполадок](docs/troubleshooting.md)
- [Обновления](docs/updating.md)
- [TURN и relay](docs/turn.md)
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
