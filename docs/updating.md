# Обновление MarMic Server

MarMic Server `0.16.17` включает официальный update agent. Он получает stable
manifest, проверяет SHA-256 artifact, создаёт backup, подготавливает новый
runtime, переключает Compose только после подготовки и возвращает предыдущий
known-good runtime при неуспешном health check.

Проверить и установить доступное обновление вручную:

```bash
sudo marmic update check
sudo marmic update
```

Автоматическая проверка выполняется `marmic-update.timer`, который installer
включает только после успешной первой health-проверки. Статус timer, lock,
journal и последнего результата:

```bash
sudo marmic update status
systemctl status marmic-update.timer
systemctl list-timers marmic-update.timer
```

`sudo marmic status` показывает состояние Compose-сервисов, а
`sudo marmic doctor` проверяет runtime, DNS, HTTPS, LiveKit, persistent storage
и целостность SQLite. Это дополняющие команды, но не замена `update status`.

Updater принимает только stable manifest для `linux/amd64`, запрещает
параллельную активацию, проверяет размер и SHA-256, создаёт known-good backup и
активирует новый Compose runtime. Если health-check или `doctor` нового runtime
не проходит, updater автоматически возвращает previous known-good version и
проверяет её здоровье. Не удаляйте `/var/lib/marmic/update` и
`/var/backups/marmic` во время диагностики.

Текущий manifest format подтверждает целостность artifact относительно
manifest с помощью SHA-256, но ещё не содержит publisher signature. Скачивайте
manifest и artifact только из официального MarMic Server release channel.

Не заменяйте Docker images вручную и не удаляйте `/var/lib/marmic`: там находятся Registry identity, private key, DB, uploads и owner state.

Для старых серверов первый переход на актуальный release выполняется
повторным запуском официального bootstrap installer. Он сохраняет
`/var/lib/marmic`, server identity и внешний proxy config; последующие
compatible обновления обнаруживаются scheduler автоматически.

Patch/security compatibility updates могут быть обязательными в соответствии с [MarMic Server Community License](../LICENSE.md). Крупные migration-sensitive обновления могут требовать подтверждения владельца.
