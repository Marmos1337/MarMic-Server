# Обновление MarMic Server

MarMic Server `0.13.3` включает официальный update agent. Он получает stable manifest, проверяет SHA-256 artifact, создаёт backup, подготавливает новый runtime, переключает Compose только после подготовки и автоматически возвращает предыдущий known-good runtime при неуспешном health check.

Проверить и установить доступное обновление вручную:

```bash
sudo marmic update
```

Автоматическая проверка выполняется установленным scheduler. Статус и результат последнего обновления доступны через:

```bash
sudo marmic status
sudo marmic doctor
```

Не заменяйте Docker images вручную и не удаляйте `/var/lib/marmic`: там находятся Registry identity, private key, DB, uploads и owner state.

Для серверов, установленных из старого `0.12.7`, первый переход на `0.13.3` выполняется повторным запуском официального bootstrap installer. Он сохраняет `/var/lib/marmic` и устанавливает update agent; последующие compatible обновления обнаруживаются scheduler автоматически.

Patch/security compatibility updates могут быть обязательными в соответствии с [MarMic Server Community License](../LICENSE.md). Крупные migration-sensitive обновления могут требовать подтверждения владельца.
