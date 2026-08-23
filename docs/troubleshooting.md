# Устранение неполадок

Начните с:

```bash
sudo marmic status
sudo marmic doctor
sudo marmic logs
```

Диагностика скрывает известные secrets, но перед публикацией вывода всё равно проверьте его вручную.

## DNS ещё не готов

DNS propagation после регистрации может занимать **до 10 минут. Это нормально**. Не удаляйте `/var/lib/marmic` и не регистрируйте новый сервер только из-за ожидания DNS.

```bash
sudo marmic doctor
```

Повторный installer должен продолжить существующую server identity.

## HTTPS не готов

Проверьте, что hostname резолвится в ваш public IP, TCP `80/443` доступны извне и Caddy запущен. DNS active и HTTPS ready — разные этапы.

## Text работает, voice нет

Проверьте UDP `50000-50100`, TCP `7881`, cloud firewall, host firewall и port forwarding. TCP `4000/7880` наружу открывать не нужно. TURN пока отсутствует.

## Owner Token не принимается

Token действует 24 часа и одноразовый. До claim выпустите новый:

```bash
sudo marmic owner-token regenerate
```

После regeneration предыдущий token недействителен. После claim regeneration запрещён.

## Docker container unhealthy

```bash
sudo marmic status
sudo marmic logs
sudo marmic doctor
```

Не используйте `docker system prune` как способ ремонта: он может затронуть другие Docker-проекты на том же хосте.

## Artifact не устанавливается

Используйте только официальный `install.sh`. Bootstrap проверяет release artifact, SHA-256, безопасные пути tar, Linux, `x86_64/amd64` и Docker Compose.

## Обновление не завершилось

Проверьте `sudo marmic doctor` и `sudo marmic logs`. Update agent сохраняет предыдущий known-good runtime и автоматически выполняет rollback при неуспешном health check. Не удаляйте update journal, backup или `/var/lib/marmic` до диагностики.

## Домашний сервер не доступен из интернета

Проверьте port forwarding, firewall, реальный WAN IP и отсутствие CGNAT.

## Из интернета работает, а из LAN — нет

Возможная причина — отсутствие NAT loopback/hairpin NAT на роутере. Проверьте адрес через мобильный интернет.

## Что прислать при диагностике

```bash
sudo marmic status
sudo marmic doctor
sudo marmic version
```

Не публикуйте Owner Token, private keys, account tokens, passwords, `.env` или пользовательские данные. Для security issue используйте [Security Policy](../SECURITY.md).
