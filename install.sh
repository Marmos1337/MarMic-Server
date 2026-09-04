#!/bin/sh
set -eu

VERSION="0.18.0"
SOURCE_COMMIT="784167fb80b6eb0289fc9f0e46b63d4962f3b63c"
ARTIFACT="marmic-server-${VERSION}-linux-amd64.tar.gz"
PINNED_SHA256="d338164ac34f0da36f23996785a337b08e225eb65a1fd33ac740bbc24405594c"
DEFAULT_BASE_URL="https://github.com/Marmos1337/MarMic-Server/releases/download/v${VERSION}"
BASE_URL="${MARMIC_DISTRIBUTION_BASE_URL:-$DEFAULT_BASE_URL}"
STAGING_ROOT="${MARMIC_BOOTSTRAP_STAGING_ROOT:-/var/tmp}"
WORK_DIR=""

if [ "$BASE_URL" != "$DEFAULT_BASE_URL" ]; then
  case "${MARMIC_BOOTSTRAP_TEST_MODE:-}:$BASE_URL" in
    disposable-loopback:http://127.0.0.1:*) ;;
    *) echo "A custom distribution origin is forbidden outside disposable loopback tests." >&2; exit 1 ;;
  esac
fi

usage() {
  cat <<EOF
MarMic Server immutable installer ${VERSION}

Usage: install.sh [--verbose] [--database-mode MODE] [--help] [--version]

This release-specific installer is pinned to one archive SHA-256. On an
existing installation it repairs only the host management updater; it does not
silently replace the running Server image.

Database modes for a new install:
  bundled_postgres  managed internal PostgreSQL (default)
  external_postgres owner-supplied PostgreSQL via environment variables
  sqlite_legacy     compatibility-only SQLite install

External PostgreSQL requires MARMIC_DATABASE_URL and the root-only
MARMIC_POSTGRES_ADMIN_URL environment variable. Credentials are never accepted
as command-line arguments. Existing installs always preserve their provider.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --verbose) MARMIC_INSTALL_VERBOSE=1; export MARMIC_INSTALL_VERBOSE ;;
    --database-mode)
      shift
      [ "$#" -gt 0 ] || { echo "--database-mode requires a value" >&2; exit 2; }
      case "$1" in
        bundled_postgres|external_postgres|sqlite_legacy) ;;
        *) echo "Unknown database mode: $1" >&2; exit 2 ;;
      esac
      MARMIC_DATABASE_MODE="$1"
      export MARMIC_DATABASE_MODE
      ;;
    --help|-h) usage; exit 0 ;;
    --version) echo "$VERSION"; exit 0 ;;
    *) echo "Unknown installer option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

cleanup() {
  status="$1"
  trap - EXIT HUP INT TERM
  case "$WORK_DIR" in
    "$STAGING_ROOT"/marmic-bootstrap.*) rm -rf "$WORK_DIR" ;;
  esac
  exit "$status"
}
trap 'cleanup $?' EXIT
trap 'cleanup 129' HUP
trap 'cleanup 130' INT
trap 'cleanup 143' TERM

for tool in curl tar awk grep mkdir mktemp mv rm; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "Missing required installer tool: $tool" >&2
    exit 1
  }
done

if [ "${MARMIC_BOOTSTRAP_VERIFY_ONLY:-0}" != "1" ]; then
  [ "$(id -u)" -eq 0 ] || {
    echo "Run the MarMic Server installer with sudo." >&2
    exit 1
  }
  [ "$(uname -s)" = "Linux" ] || {
    echo "MarMic Server supports Linux only." >&2
    exit 1
  }
  case "$(uname -m)" in
    x86_64|amd64) ;;
    *) echo "MarMic Server supports x86_64/amd64 only." >&2; exit 1 ;;
  esac
  docker compose version >/dev/null 2>&1 || {
    echo "Docker Engine with the Compose plugin is required." >&2
    exit 1
  }
fi

case "$STAGING_ROOT" in
  /*) ;;
  *) echo "MarMic bootstrap staging root must be an absolute path." >&2; exit 1 ;;
esac
mkdir -p "$STAGING_ROOT"
if [ -L "$STAGING_ROOT" ] || [ ! -d "$STAGING_ROOT" ]; then
  echo "MarMic bootstrap staging root is unsafe." >&2
  exit 1
fi
WORK_DIR="$(mktemp -d "$STAGING_ROOT/marmic-bootstrap.XXXXXX")"
partial="$WORK_DIR/$ARTIFACT.part"
if [ "${MARMIC_INSTALL_VERBOSE:-0}" = "1" ]; then
  curl_progress="--progress-bar"
else
  curl_progress="--silent"
fi
if [ "$BASE_URL" = "$DEFAULT_BASE_URL" ]; then
  curl_protocols="=https"
else
  curl_protocols="=http"
fi
curl --fail --show-error --location --proto "$curl_protocols" --proto-redir "$curl_protocols" $curl_progress \
  --retry 4 --retry-all-errors --retry-delay 2 --retry-max-time 120 \
  --connect-timeout 15 --max-time 1200 \
  "$BASE_URL/$ARTIFACT" --output "$partial"
mv "$partial" "$WORK_DIR/$ARTIFACT"

if command -v sha256sum >/dev/null 2>&1; then
  actual_sha256="$(sha256sum "$WORK_DIR/$ARTIFACT" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  actual_sha256="$(shasum -a 256 "$WORK_DIR/$ARTIFACT" | awk '{print $1}')"
else
  echo "sha256sum or shasum is required." >&2
  exit 1
fi
[ "$actual_sha256" = "$PINNED_SHA256" ] || {
  echo "MarMic Server archive SHA-256 mismatch." >&2
  exit 1
}

PAYLOAD="marmic-server-${VERSION}-linux-amd64"
tar -tzf "$WORK_DIR/$ARTIFACT" >"$WORK_DIR/archive.list"
awk -v root="$PAYLOAD/" '
  /^\// || /(^|\/)\.\.($|\/)/ || index($0, root) != 1 { bad = 1 }
  /(^|\/)\._/ || /(^|\/)\.DS_Store($|\/)/ { bad = 1 }
  END { exit bad }
' "$WORK_DIR/archive.list" || {
  echo "MarMic Server archive contains unsafe paths." >&2
  exit 1
}
if tar -tvzf "$WORK_DIR/$ARTIFACT" | grep -Eq '^[^d-]'; then
  echo "MarMic Server archive contains unsupported links or special files." >&2
  exit 1
fi
tar -xzf "$WORK_DIR/$ARTIFACT" -C "$WORK_DIR" --no-same-owner

manifest="$WORK_DIR/$PAYLOAD/manifest.json"
runtime_node="$WORK_DIR/$PAYLOAD/runtime/node"
"$runtime_node" -e '
  const manifest = require(process.argv[1]);
  const [version, commit] = process.argv.slice(2);
  if (manifest.version !== version || manifest.sourceCommit !== commit)
    throw new Error("Pinned installer manifest identity mismatch.");
' "$manifest" "$VERSION" "$SOURCE_COMMIT"

if [ "${MARMIC_BOOTSTRAP_VERIFY_ONLY:-0}" = "1" ]; then
  echo "Pinned MarMic Server ${VERSION} archive verified."
  exit 0
fi

export MARMIC_SERVER_VERSION="$VERSION"
MARMIC_SERVER_IMAGE="$("$runtime_node" -p 'require(process.argv[1]).serverImage' "$manifest")"
export MARMIC_SERVER_IMAGE
MARMIC_REGISTRY_URL="${MARMIC_REGISTRY_URL:-https://hub.mic.marhub.ru}"
MARMIC_IDENTITY_URL="${MARMIC_IDENTITY_URL:-https://hub.mic.marhub.ru}"
export MARMIC_REGISTRY_URL MARMIC_IDENTITY_URL
"$runtime_node" "$WORK_DIR/$PAYLOAD/bin/install.mjs"
