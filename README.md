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

## Установка — планируется

One-command installer ещё не опубликован. Планируемый flow:

```text
one-command install
→ preflight
→ server registration
→ автоматический адрес вида xxxxx.srv.marmic.udav.team
→ DNS propagation, которая может занимать до 10 минут
→ HTTPS
→ Owner Token
→ claim владельца через MarMic
```

После установки обновление DNS может занимать **до 10 минут**. Это нормальное поведение, а не признак неудачной установки.

Планируются два сценария:

- VPS с публичным IP;
- домашний Linux server.

Для домашней установки будет опубликовано отдельное руководство с необходимыми правилами port forwarding и firewall. До завершения инфраструктуры конкретные порты здесь намеренно не указаны.

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

Этот repository — публичная основа проекта. Installer, registry, DNS provisioning, Owner Token backend, telemetry backend, update agent и production runtime distribution пока не опубликованы в этом репозитории.
