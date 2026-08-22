# Резервное копирование

> Статус: официальный `marmic backup` / `marmic restore` ещё не опубликован.

Persistent данные находятся в:
- `/var/lib/marmic` — DB, uploads, Registry identity и state;
- `/etc/marmic` — конфигурация и service secrets.

`/opt/marmic` — заменяемый runtime.

До появления официального backup CLI рекомендуется делать инфраструктурный snapshot/backup persistent каталогов и хранить его в защищённом месте.

Особенно важно сохранять Registry identity: потеря private server identity может привести к невозможности продолжить работу с тем же `server_id`.

Не публикуйте и не помещайте в Git private server keys, service secrets, `.env`, Owner Token или пользовательскую DB/uploads.

Официальный backup/restore flow позже добавит integrity checks, retention и restore validation.
