# Сетевые порты Stage 3

Открываются только фактически опубликованные Compose ports:

| Протокол | Порт | Назначение |
| --- | ---: | --- |
| TCP | 80 | Caddy: ACME HTTP challenge и redirect на HTTPS |
| TCP | 443 | Caddy: HTTPS, API и WebSocket reverse proxy |
| TCP | 7881 | LiveKit WebRTC TCP fallback |
| UDP | 50000-50100 | LiveKit WebRTC media range |

MarMic Server `4000/tcp` и LiveKit signalling `7880/tcp` остаются внутри Docker
network и наружу не публикуются. TURN ports отсутствуют: TURN не входит в
Stage 3.
