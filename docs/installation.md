# Установка MarMic Server — Stage 3 preview

> Поддерживается: Debian/Ubuntu, Linux x86_64/amd64.

Требования:

- публичный IPv4 (IPv6 определяется дополнительно при наличии);
- установленный Docker Engine с Compose plugin;
- свободные [сетевые порты](ports.md);
- права `sudo`/root;
- доступ к `hub.marmos.udav.team`, GitHub Releases и ACME endpoints.

Запуск:

```bash
curl -fsSL https://raw.githubusercontent.com/Marmos1337/MarMic-Server/main/install.sh | sudo sh
```

Bootstrap скачивает закреплённый artifact, проверяет SHA-256, проверяет Linux и
`amd64`, после чего запускает bundled installer. Он не клонирует Git repository.

Установка:

1. Запуск официального bootstrap installer.
2. Проверка ОС, архитектуры, ресурсов и сетевой доступности (preflight).
3. Регистрация MarMic Server.
4. Получение технического адреса вида `xxxxx.srv.marmic.udav.team`.
5. Ожидание DNS propagation.
6. Настройка HTTPS.
7. Получение одноразового Owner Token.
8. Вывод одноразового Owner Token только в текущую консоль.
9. Claim владельца через Desktop или Web MarMic.

Обновление DNS после регистрации может занимать **до 10 минут**. Это ожидаемое поведение.

Если ожидание истекло, registration и private server identity сохраняются в
`/var/lib/marmic/registry`. Проверьте `sudo marmic doctor` и повторно запустите
installer: новый server identity создаваться не должен.

Данные разделены так:

- `/opt/marmic` — заменяемый runtime;
- `/etc/marmic` — пользовательская конфигурация и service secrets;
- `/var/lib/marmic` — SQLite DB, uploads, registry identity и ACME state;
- `/var/backups/marmic` — будущие официальные backups.

Private Ed25519 key хранится только в `/var/lib/marmic/registry` с mode `0600`.
Owner Token не записывается в обычные logs и после передачи в консоль в
plaintext не сохраняется.

Доступные команды:

```text
marmic status
marmic doctor
marmic logs
marmic restart
marmic version
marmic owner-token regenerate
```

Regenerate разрешён только до успешного claim владельца.
