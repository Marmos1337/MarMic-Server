#!/bin/sh
set -eu

VERSION="0.16.21"
ARTIFACT="marmic-server-${VERSION}-linux-amd64.tar.gz"
PINNED_SHA256="6e74285641b62db3ad27e56b1850746ca9170ad7a584ceb76b7224ccf4bcb830"
BASE_URL="${MARMIC_DISTRIBUTION_BASE_URL:-https://github.com/Marmos1337/MarMic-Server/releases/download/v${VERSION}}"
STAGING_ROOT="${MARMIC_BOOTSTRAP_STAGING_ROOT:-/var/tmp}"
REQUIRED_STAGING_BYTES=1073741824
WORK_DIR=""
CURRENT_STAGE="bootstrap"

usage() {
  cat <<'EOF'
MarMic Server installer 0.16.21

Usage: install.sh [--verbose] [--help] [--version]

  --verbose  show download, Docker and diagnostic details
  --help     show this help
  --version  print the installer version
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --verbose) MARMIC_INSTALL_VERBOSE=1; export MARMIC_INSTALL_VERBOSE ;;
    --help|-h) usage; exit 0 ;;
    --version) echo "$VERSION"; exit 0 ;;
    *) echo "Неизвестный аргумент: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

cleanup() {
  status="$1"
  trap - EXIT HUP INT TERM
  if [ "$status" -ne 0 ]; then
    echo "Установка MarMic Server завершилась с ошибкой на этапе ${CURRENT_STAGE}. Подробный повтор можно выполнить с --verbose." >&2
  fi
  case "$WORK_DIR" in
    "$STAGING_ROOT"/marmic-bootstrap.*) rm -rf "$WORK_DIR" ;;
  esac
  exit "$status"
}

trap 'cleanup $?' EXIT
trap 'cleanup 129' HUP
trap 'cleanup 130' INT
trap 'cleanup 143' TERM

for tool in curl tar awk mv df mkdir mktemp rm cat; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "Не найден обязательный инструмент: $tool" >&2
    exit 1
  }
done

preflight() {
  [ "$(id -u)" -eq 0 ] || {
    echo "Запустите installer через sudo." >&2
    return 1
  }
  [ "$(uname -s)" = "Linux" ] || {
    echo "MarMic Server поддерживает только Linux." >&2
    return 1
  }
  case "$(uname -m)" in
    x86_64|amd64) ;;
    *) echo "MarMic Server поддерживает только x86_64/amd64." >&2; return 1 ;;
  esac
  command -v docker >/dev/null 2>&1 || {
    echo "Docker Engine с Compose plugin должен быть установлен заранее." >&2
    return 1
  }
  if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose plugin недоступен. Установите его и повторите команду." >&2
    return 1
  fi
}

check_staging_space() {
  operation="$1"
  if ! available_kib="$(df -Pk "$WORK_DIR" | awk 'NR == 2 { print $4 }')"; then
    echo "Не удалось проверить свободное место для staging: $WORK_DIR" >&2
    return 1
  fi
  case "$available_kib" in
    ''|*[!0-9]*)
      echo "Не удалось определить свободное место для staging: $WORK_DIR" >&2
      return 1
      ;;
  esac
  available_bytes=$((available_kib * 1024))
  if [ "$available_bytes" -lt "$REQUIRED_STAGING_BYTES" ]; then
    required_mib=$((REQUIRED_STAGING_BYTES / 1024 / 1024))
    available_mib=$((available_bytes / 1024 / 1024))
    echo "Недостаточно места для ${operation} MarMic Server на $STAGING_ROOT: требуется не менее ${required_mib} MiB (${REQUIRED_STAGING_BYTES} bytes), доступно ${available_mib} MiB (${available_bytes} bytes)." >&2
    return 1
  fi
}

prepare_staging() {
  [ -n "$STAGING_ROOT" ] || {
    echo "Не задан каталог staging для MarMic Server." >&2
    return 1
  }
  case "$STAGING_ROOT" in
    /) ;;
    */) STAGING_ROOT="${STAGING_ROOT%/}" ;;
  esac
  if ! mkdir -p "$STAGING_ROOT"; then
    echo "Не удалось создать staging-каталог: $STAGING_ROOT" >&2
    return 1
  fi
  if ! WORK_DIR="$(mktemp -d "$STAGING_ROOT/marmic-bootstrap.XXXXXX")"; then
    echo "Не удалось создать рабочий каталог в $STAGING_ROOT" >&2
    return 1
  fi
  check_staging_space "загрузки и распаковки"
  echo "MarMic Server: staging $WORK_DIR, доступно $((available_bytes / 1024 / 1024)) MiB."
}

download_file() {
  url="$1"
  destination="$2"
  label="$3"
  partial="$destination.part"
  rm -f "$partial"
  echo "MarMic Server: скачиваем ${label}…"
  if [ "${MARMIC_INSTALL_VERBOSE:-0}" = "1" ]; then
    curl_flags="--progress-bar"
  else
    curl_flags="--silent"
  fi
  if ! curl \
    --fail \
    --show-error \
    --location \
    $curl_flags \
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

echo "MarMic Server $VERSION: безопасная установка."
if [ "${MARMIC_BOOTSTRAP_VERIFY_ONLY:-0}" != "1" ]; then
  CURRENT_STAGE="проверка системы"
  echo "[1/6] Проверка системы"
  preflight
  echo "[1/6] Готово"
fi
CURRENT_STAGE="загрузка и проверка runtime"
echo "[2/6] Загрузка и проверка runtime"
prepare_staging
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
echo "[2/6] SHA-256 подтверждён"

PAYLOAD="marmic-server-${VERSION}-linux-amd64"
ARCHIVE_LIST="$WORK_DIR/archive.list"
CURRENT_STAGE="проверка структуры artifact"
echo "[3/6] Проверка структуры artifact"
if ! tar -tzf "$WORK_DIR/$ARTIFACT" >"$ARCHIVE_LIST"; then
  echo "Не удалось прочитать структуру artifact." >&2
  exit 1
fi
if awk -v root="$PAYLOAD/" '
  /^\// || /(^|\/)\.\.($|\/)/ || index($0, root) != 1 { bad = 1 }
  END { exit bad }
' "$ARCHIVE_LIST"; then
  :
else
  echo "Artifact содержит небезопасные пути." >&2
  exit 1
fi
echo "[4/6] Распаковка runtime"
check_staging_space "распаковки"
if ! tar -xzf "$WORK_DIR/$ARTIFACT" -C "$WORK_DIR" 2>"$WORK_DIR/tar.log"; then
  echo "Не удалось распаковать MarMic Server runtime." >&2
  cat "$WORK_DIR/tar.log" >&2
  exit 1
fi
rm -f "$WORK_DIR/$ARTIFACT"
echo "[4/6] Runtime подготовлен"
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

manifest="$WORK_DIR/$PAYLOAD/manifest.json"
export MARMIC_SERVER_VERSION="$VERSION"
if ! MARMIC_SERVER_IMAGE="$("$WORK_DIR/$PAYLOAD/runtime/node" -p "require(process.argv[1]).serverImage" "$manifest")"; then
  echo "Не удалось прочитать manifest MarMic Server runtime." >&2
  exit 1
fi
export MARMIC_SERVER_IMAGE
MARMIC_REGISTRY_URL="${MARMIC_REGISTRY_URL:-https://hub.mic.marhub.ru}"
MARMIC_IDENTITY_URL="${MARMIC_IDENTITY_URL:-https://hub.mic.marhub.ru}"
export MARMIC_REGISTRY_URL MARMIC_IDENTITY_URL

CURRENT_STAGE="регистрация, DNS и запуск runtime"
echo "[5/6] Регистрация, DNS и запуск runtime"
"$WORK_DIR/$PAYLOAD/runtime/node" "$WORK_DIR/$PAYLOAD/bin/install.mjs" || {
  status=$?
  echo "Установка MarMic Server завершилась с ошибкой (код $status). Повторный запуск этой же команды безопасен." >&2
  exit "$status"
}
CURRENT_STAGE="проверка"
echo "[6/6] Проверка"
echo "MarMic Server $VERSION: установка завершена."
