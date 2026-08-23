# Установка MarMic Server

> Текущий стабильный release: `v0.13.0`.

## 1. Требования

Поддерживается Debian 12 и Ubuntu 24.04 на Linux `x86_64/amd64`.

Нужно:
- root или `sudo`;
- Docker Engine;
- Docker Compose plugin;
- публичный IPv4;
- доступ к GitHub Releases, `hub.marmos.udav.team` и ACME endpoints;
- свободные TCP `80`, `443`, `7881` и UDP `50000-50100`.

Проверка:

```bash
uname -m
docker version
docker compose version
```

Для `uname -m` ожидается `x86_64`.

## 2. Сетевые порты

Разрешите в firewall:
- TCP `80`;
- TCP `443`;
- TCP `7881`;
- UDP `50000-50100`.

Если VPS-провайдер использует отдельный cloud firewall/security group, откройте эти порты и там. Внутренние Docker ports `4000/tcp` и `7880/tcp` наружу публиковать не нужно.

Для домашнего сервера дополнительно нужен port forwarding. См. [home-server.md](home-server.md).

## 3. Установка

```bash
sh -c 'set -eu; tmp="$(mktemp "${TMPDIR:-/tmp}/marmic-install.XXXXXX")"; trap "status=\$?; trap - EXIT HUP INT TERM; rm -f \"$tmp\"; exit \$status" EXIT; trap "exit 129" HUP; trap "exit 130" INT; trap "exit 143" TERM; echo "Скачиваем официальный MarMic Server installer…"; if ! curl --fail --show-error --location --retry 4 --retry-all-errors --retry-delay 2 --retry-max-time 60 --connect-timeout 15 --max-time 180 https://raw.githubusercontent.com/Marmos1337/MarMic-Server/main/install.sh --output "$tmp"; then echo "Не удалось полностью скачать MarMic Server installer." >&2; exit 1; fi; if [ ! -s "$tmp" ]; then echo "Загружен пустой MarMic Server installer." >&2; exit 1; fi; sudo sh "$tmp"'
```

Это одна команда, но она не исполняет поток `curl` напрямую: bootstrap должен
полностью и успешно сохраниться во временный файл. Exit code installer
сохраняется, а файл удаляется при любом завершении.

## 4. Что делает installer

Installer:
1. проверяет Linux и `amd64`;
2. проверяет Docker Engine и Compose;
3. скачивает официальный artifact;
4. сверяет SHA-256;
5. создаёт локальную Ed25519 server identity;
6. сохраняет private key только на сервере;
7. регистрирует сервер в MarMic Registry;
8. получает `server_id`;
9. регистрирует public IP;
10. получает hostname `xxxxxxxx.srv.marmic.udav.team`;
11. ждёт DNS active;
12. создаёт persistent layout;
13. загружает bundled OCI images;
14. запускает MarMic Server, LiveKit и Caddy;
15. запускает HTTPS/ACME flow;
16. выводит Owner Token.

## 5. DNS и HTTPS

После создания DNS записи распространение может занимать **до 10 минут. Это нормально**.

Installer не должен уничтожать регистрацию при timeout ожидания. Server identity и Registry state сохраняются в `/var/lib/marmic/registry`.

Если DNS ещё не готов:

```bash
sudo marmic doctor
```

Caddy автоматически получает HTTPS certificate через ACME после того, как hostname указывает на сервер и TCP `80/443` доступны извне.

## 6. Owner Token и claim

После первой установки в консоли появляется одноразовый Owner Token. Не публикуйте его.

Чтобы стать владельцем:
1. войдите в MarMic Desktop или Web;
2. добавьте/откройте сервер по выданному hostname;
3. введите Owner Token в запросе activation/claim;
4. после успешного claim текущий пользователь получает owner role и permissions.

Token действует 24 часа, одноразовый, Hub хранит только hash.

До claim можно выпустить новый:

```bash
sudo marmic owner-token regenerate
```

Старый token сразу инвалидируется.

## 7. Проверка после установки

```bash
sudo marmic status
sudo marmic doctor
sudo marmic version
```

Затем проверьте HTTPS, подключение из MarMic, Owner claim, text chat и voice. Для voice лучше использовать два разных клиента/устройства.

## 8. Перезапуск

```bash
sudo marmic restart
sudo marmic status
sudo marmic doctor
```

## 9. Повторный запуск installer

Повторный запуск bootstrap допустим. Он не должен создавать новый `server_id`, заменять private key, удалять DB/uploads или очищать `/var/lib/marmic`.

Если flow был прерван на DNS/HTTPS шаге, повторный запуск должен продолжить существующее состояние.

## 10. Где лежат данные

- `/opt/marmic` — заменяемый runtime;
- `/etc/marmic` — конфигурация и service secrets;
- `/var/lib/marmic` — SQLite DB, uploads, Registry identity и persistent state;
- `/var/backups/marmic` — каталог резервных копий.

Private Ed25519 key никогда не отправляется Hub.

## 11. Команды

```bash
sudo marmic status
sudo marmic doctor
sudo marmic logs
sudo marmic restart
sudo marmic version
sudo marmic owner-token regenerate
```

## 12. Что пока не входит в текущий release

- automatic update agent;
- официальный `marmic backup` / `marmic restore`;
- arm64;
- TURN;
- полностью автоматический сценарий для CGNAT.
