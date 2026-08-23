#!/bin/sh
set -eu

VERSION="0.13.0"
ARTIFACT="marmic-server-${VERSION}-linux-amd64.tar.gz"
PINNED_SHA256="763b949c74e3710f180631db51ed3739f508415ff9a9c20a08a31bfac94e84c8"
BASE_URL="${MARMIC_DISTRIBUTION_BASE_URL:-https://github.com/Marmos1337/MarMic-Server/releases/download/v${VERSION}}"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/marmic-bootstrap.XXXXXX")"

trap 'status=$?; trap - EXIT HUP INT TERM; rm -rf "$WORK_DIR"; exit "$status"' EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

for tool in curl tar awk mv; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "Не найден обязательный инструмент: $tool" >&2
    exit 1
  }
done

download_file() {
  url="$1"
  destination="$2"
  label="$3"
  partial="$destination.part"
  rm -f "$partial"
  echo "MarMic Server: скачиваем ${label}…"
  if ! curl \
    --fail \
    --show-error \
    --location \
    --progress-bar \
    --retry 4 \
    --retry-all-errors \
    --retry-delay 2 \
    --retry-max-time 120 \
    --connect-timeout 15 \
    --max-time 1200 \
    "$url" \
    --output "$partial"; then
    rm -f "$partial"
    echo "Не удалось скачать $label. Установка MarMic Server не изменена." >&2
    return 1
  fi
  if [ ! -s "$partial" ]; then
    rm -f "$partial"
    echo "Загружен пустой $label. Установка остановлена." >&2
    return 1
  fi
  mv "$partial" "$destination"
}

echo "MarMic Server $VERSION: начинаем безопасную установку."
download_file "$BASE_URL/$ARTIFACT" "$WORK_DIR/$ARTIFACT" "runtime artifact"
download_file "$BASE_URL/$ARTIFACT.sha256" "$WORK_DIR/$ARTIFACT.sha256" "SHA-256 manifest"

expected_sha256="$(awk 'NR == 1 { print $1 }' "$WORK_DIR/$ARTIFACT.sha256")"
if command -v sha256sum >/dev/null 2>&1; then
  actual_sha256="$(sha256sum "$WORK_DIR/$ARTIFACT" | awk '{ print $1 }')"
elif command -v shasum >/dev/null 2>&1; then
  actual_sha256="$(shasum -a 256 "$WORK_DIR/$ARTIFACT" | awk '{ print $1 }')"
else
  echo "Не найден sha256sum или shasum для проверки artifact." >&2
  exit 1
fi

if [ "$expected_sha256" != "$PINNED_SHA256" ] || [ "$actual_sha256" != "$PINNED_SHA256" ]; then
  echo "Ошибка проверки SHA-256 MarMic Server distribution." >&2
  exit 1
fi
echo "MarMic Server: SHA-256 подтверждён."

PAYLOAD="marmic-server-${VERSION}-linux-amd64"
if tar -tzf "$WORK_DIR/$ARTIFACT" | awk -v root="$PAYLOAD/" '
  /^\// || /(^|\/)\.\.($|\/)/ || index($0, root) != 1 { bad = 1 }
  END { exit bad }
'; then
  :
else
  echo "Artifact содержит небезопасные пути." >&2
  exit 1
fi
if ! tar -xzf "$WORK_DIR/$ARTIFACT" -C "$WORK_DIR" 2>"$WORK_DIR/tar.log"; then
  cat "$WORK_DIR/tar.log" >&2
  exit 1
fi
echo "MarMic Server: artifact проверен и подготовлен."
if [ "${MARMIC_INSTALL_VERBOSE:-0}" = "1" ] && [ -s "$WORK_DIR/tar.log" ]; then
  cat "$WORK_DIR/tar.log" >&2
fi

if [ "${MARMIC_BOOTSTRAP_VERIFY_ONLY:-0}" = "1" ]; then
  node -e '
    const manifest = require(process.argv[1]);
    console.log(`Artifact verified: ${manifest.version} ${manifest.architecture} ${manifest.sourceCommit}`);
  ' "$WORK_DIR/$PAYLOAD/manifest.json"
  exit 0
fi

[ "$(id -u)" -eq 0 ] || {
  echo "Запустите installer через sudo." >&2
  exit 1
}
[ "$(uname -s)" = "Linux" ] || {
  echo "MarMic Server поддерживает только Linux." >&2
  exit 1
}
case "$(uname -m)" in
  x86_64|amd64) ;;
  *) echo "MarMic Server поддерживает только x86_64/amd64." >&2; exit 1 ;;
esac
command -v docker >/dev/null 2>&1 || {
  echo "Docker Engine с Compose plugin должен быть установлен заранее." >&2
  exit 1
}
docker compose version >/dev/null

manifest="$WORK_DIR/$PAYLOAD/manifest.json"
export MARMIC_SERVER_VERSION="$VERSION"
export MARMIC_SERVER_IMAGE="$("$WORK_DIR/$PAYLOAD/runtime/node" -p "require(process.argv[1]).serverImage" "$manifest")"
MARMIC_REGISTRY_URL="${MARMIC_REGISTRY_URL:-https://hub.marmos.udav.team}"
MARMIC_IDENTITY_URL="${MARMIC_IDENTITY_URL:-https://hub.marmos.udav.team}"
export MARMIC_REGISTRY_URL MARMIC_IDENTITY_URL

"$WORK_DIR/$PAYLOAD/runtime/node" "$WORK_DIR/$PAYLOAD/bin/install.mjs"
