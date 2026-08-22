# MarMic Server

MarMic Server — self-hosted сервер для MarMic, работающий на инфраструктуре владельца: VPS с публичным IP или домашнем Linux-сервере.

## Лицензирование

- Некоммерческое использование бесплатно.
- Количество Community Servers для некоммерческого использования не ограничено.
- Коммерческое использование возможно только по отдельному соглашению с правообладателем.
- MarMic Server является проприетарным программным обеспечением.
- Исходный код server runtime публично не распространяется.
- Владелец запускает официальный runtime и изменяет только разрешённые параметры конфигурации.

**Публичный репозиторий не означает, что MarMic Server runtime является open-source.** Этот репозиторий содержит документацию, лицензионные документы и в будущем может содержать открытый bootstrap installer. Проприетарный runtime остаётся отдельным официальным компонентом MarMic.

## Stage 3 preview: первая установка

Первая проверенная distribution доступна для Debian/Ubuntu на `x86_64/amd64`.
Нужны установленный Docker Engine и Docker Compose plugin. Для тестового
self-hosted сервера:

```bash
curl -fsSL https://raw.githubusercontent.com/Marmos1337/MarMic-Server/main/install.sh | sudo sh
```

Bootstrap проверяет SHA-256 официального artifact и запускает proprietary
runtime installer. Репозиторий и development workspace пользователю не
передаются.

Фактический flow:

```text
one-command bootstrap
→ preflight
→ server registration
→ автоматический адрес вида xxxxx.srv.marmic.udav.team
→ DNS propagation, которая может занимать до 10 минут
→ HTTPS
→ Owner Token
→ claim владельца через MarMic
```

После установки обновление DNS может занимать **до 10 минут**. Это нормальное поведение, а не признак неудачной установки.

Stage 3 поддерживает два сценария:

- VPS с публичным IP;
- домашний Linux server.

Для домашней установки используйте отдельное руководство с фактическими
правилами port forwarding и firewall. TURN, arm64, автоматическое обновление и
официальный backup/restore CLI пока не входят в Stage 3.

## Документация

- [Установка](docs/installation.md)
- [Домашний сервер](docs/home-server.md)
- [Сетевые порты](docs/ports.md)
- [Обновление](docs/updating.md)
- [Резервное копирование](docs/backups.md)
- [Устранение неполадок](docs/troubleshooting.md)

## Правовые документы и безопасность

- [MarMic Server Community License](LICENSE.md)
- [Commercial use](COMMERCIAL.md)
- [Privacy & Telemetry Policy](PRIVACY.md)
- [Security Policy](SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Текущий статус

Этот repository содержит открытый обозримый bootstrap и документацию. Сам
MarMic Server runtime остаётся proprietary и поставляется отдельным официальным
artifact под MarMic Server Community License. Stage 3 проверен в полном
локальном Compose stack; внешний VPS/home-router и реальная выдача ACME
certificate требуют ручной проверки в конкретной сети.
