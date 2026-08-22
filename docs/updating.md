# Обновление MarMic Server

> Статус: официальный automatic update agent ещё не включён в текущий release.

Не обновляйте MarMic Server заменой случайных Docker images или сторонних artifacts.

Планируемый официальный update path: официальный release manifest → проверка совместимости и подписи/хэша → backup при необходимости → migration preflight → update → health check → rollback при критической ошибке.

Patch/security compatibility updates могут быть обязательными в соответствии с [MarMic Server Community License](../LICENSE.md). Крупные migration-sensitive обновления могут требовать подтверждения владельца.

Пока официальный `marmic update` не опубликован, используйте только явно документированные release-инструкции.
