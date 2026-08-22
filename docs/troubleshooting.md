# Устранение неполадок Stage 3

Начните с:

```bash
sudo marmic status
sudo marmic doctor
sudo marmic logs
```

Вывод автоматически скрывает известные secrets. Перед публикацией диагностики
всё равно проверьте её вручную.

## Технический адрес ещё не открывается

После регистрации обновление DNS может занимать до **10 минут**. В этот период адрес может ещё не резолвиться или открываться нестабильно.

Registry identity сохраняется. Не удаляйте `/var/lib/marmic`; повторный запуск
installer продолжает существующую регистрацию.

## HTTPS ещё не готов

Убедитесь, что DNS указывает на текущий public IP, а TCP 80/443 доступны из
интернета. Caddy получает certificate через ACME автоматически. Состояние
`HTTPS pending` отличается от потери registration.

## Voice не подключается

Проверьте TCP 7881 и UDP 50000-50100 на host firewall и router. Не открывайте
внутренние 4000/7880. TURN пока отсутствует.

## Owner Token

Token действует 24 часа, одноразовый и после claim непригоден. До claim новый
token можно получить командой `sudo marmic owner-token regenerate`; старый
сразу инвалидируется. После claim regeneration запрещён.

## Installer или runtime недоступен

Используйте только bootstrap из этого repository и artifact из официального
GitHub Release. Bootstrap прекращает установку при несовпадении SHA-256.

## Безопасность

Не публикуйте credentials, Owner Token, private key, authentication tokens или содержимое локальной базы. Для сообщения об уязвимости используйте порядок из [Security Policy](../SECURITY.md).

Полноценные `backup`, `restore`, `update`, arm64 и TURN появятся на следующем
этапе.
