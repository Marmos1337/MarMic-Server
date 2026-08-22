#!/bin/sh
set -eu

VERSION="0.12.4-stage3.1"
ARTIFACT="marmic-server-${VERSION}-linux-amd64.tar.gz"
PINNED_SHA256="23de87c61327a9c9e2aa19fe13e4aa86890e6e68042240476aebb243d7bd260a"
BASE_URL="${MARMIC_DISTRIBUTION_BASE_URL:-https://github.com/Marmos1337/MarMic-Server/releases/download/v${VERSION}}"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/marmic-bootstrap.XXXXXX")"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT HUP INT TERM

for tool in curl tar awk; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "Не найден обязательный инструмент: $tool" >&2
    exit 1
  }
done

curl -fsSL "$BASE_URL/$ARTIFACT" -o "$WORK_DIR/$ARTIFACT"
curl -fsSL "$BASE_URL/$ARTIFACT.sha256" -o "$WORK_DIR/$ARTIFACT.sha256"

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
tar -xzf "$WORK_DIR/$ARTIFACT" -C "$WORK_DIR"

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
  echo "Stage 3 поддерживает только Linux." >&2
  exit 1
}
case "$(uname -m)" in
  x86_64|amd64) ;;
  *) echo "Stage 3 поддерживает только x86_64/amd64." >&2; exit 1 ;;
esac
command -v docker >/dev/null 2>&1 || {
  echo "Docker Engine с Compose plugin должен быть установлен заранее." >&2
  exit 1
}
docker compose version >/dev/null

manifest="$WORK_DIR/$PAYLOAD/manifest.json"
export MARMIC_SERVER_VERSION="$VERSION"
export MARMIC_SERVER_IMAGE="$("$WORK_DIR/$PAYLOAD/runtime/node" -p "require(process.argv[1]).serverImage" "$manifest")"
export MARMIC_REGISTRY_URL="${MARMIC_REGISTRY_URL:-https://hub.marmos.udav.team}"
export MARMIC_IDENTITY_URL="${MARMIC_IDENTITY_URL:-https://hub.marmos.udav.team}"

"$WORK_DIR/$PAYLOAD/runtime/node" "$WORK_DIR/$PAYLOAD/bin/install.mjs"
