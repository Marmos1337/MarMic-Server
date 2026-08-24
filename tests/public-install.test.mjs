import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const bootstrap = () => read('install.sh');
const pinnedSha = () =>
  /PINNED_SHA256="([^"]+)"/u.exec(bootstrap())?.[1] ?? '';

function canonicalCommand(markdown) {
  const match = /```bash\n(sh -c '[^\n]+')\n```/u.exec(markdown);
  assert.ok(match, 'canonical one-command installer is missing');
  return match[1];
}

function writeExecutable(path, source) {
  writeFileSync(path, source, 'utf8');
  chmodSync(path, 0o755);
}

function runCanonical(mode) {
  const directory = mkdtempSync(join(tmpdir(), 'marmic-public-install-'));
  const bin = join(directory, 'bin');
  const marker = join(directory, 'installed');
  const trace = join(directory, 'download-path');
  spawnSync('mkdir', ['-p', bin], { stdio: 'inherit' });
  writeExecutable(
    join(bin, 'curl'),
    `#!/bin/sh
set -eu
output=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = '--output' ]; then output="$2"; shift 2; else shift; fi
done
[ -n "$output" ]
printf '%s' "$output" > "$FAKE_CURL_TRACE"
if [ "$FAKE_CURL_MODE" = 'partial' ]; then
  printf '#!/bin/sh\n' > "$output"
  exit 18
fi
printf '#!/bin/sh\nset -eu\nprintf installed > "$TEST_INSTALL_MARKER"\n' > "$output"
`,
  );
  writeExecutable(join(bin, 'sudo'), '#!/bin/sh\nexec "$@"\n');
  const result = spawnSync('sh', ['-c', canonicalCommand(read('README.md'))], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
      FAKE_CURL_MODE: mode,
      FAKE_CURL_TRACE: trace,
      TEST_INSTALL_MARKER: marker,
    },
  });
  const downloadedPath = readFileSync(trace, 'utf8');
  return { result, marker, downloadedPath };
}

test('README and installation guides use the same non-piped canonical command', () => {
  const expected = canonicalCommand(read('README.md'));
  assert.equal(canonicalCommand(read('docs/installation.md')), expected);
  assert.equal(canonicalCommand(read('docs/home-server.md')), expected);
  assert.doesNotMatch(expected, /\|\s*(?:sudo\s+)?sh\b/u);
  assert.match(expected, /mktemp/u);
  assert.match(expected, /--output "\$tmp"/u);
  assert.match(expected, /\[ ! -s "\$tmp" \]/u);
  assert.match(expected, /sudo sh "\$tmp"/u);
});

test('canonical command downloads fully, executes once, and removes its temp file', () => {
  const { result, marker, downloadedPath } = runCanonical('success');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(marker, 'utf8'), 'installed');
  assert.equal(spawnSync('test', ['!', '-e', downloadedPath]).status, 0);
});

test('interrupted bootstrap download is visible, non-zero, and never executes', () => {
  const { result, marker, downloadedPath } = runCanonical('partial');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Не удалось полностью скачать/u);
  assert.equal(spawnSync('test', ['!', '-e', marker]).status, 0);
  assert.equal(spawnSync('test', ['!', '-e', downloadedPath]).status, 0);
});

test('bootstrap itself uses bounded retries and atomic partial downloads', () => {
  const source = bootstrap();
  assert.match(source, /VERSION="0\.13\.6"/u);
  assert.match(source, /--retry 4/u);
  assert.match(source, /--retry-all-errors/u);
  assert.match(source, /--connect-timeout 15/u);
  assert.match(source, /--max-time 1200/u);
  assert.match(source, /destination\.part/u);
  assert.match(source, /mv "\$partial" "\$destination"/u);
});

test('clean install fails visibly before download when Docker Compose is unavailable', () => {
  const directory = mkdtempSync(join(tmpdir(), 'marmic-bootstrap-preflight-'));
  const bin = join(directory, 'bin');
  const curlMarker = join(directory, 'curl-called');
  spawnSync('mkdir', ['-p', bin], { stdio: 'inherit' });
  writeExecutable(join(bin, 'id'), '#!/bin/sh\nprintf 0\n');
  writeExecutable(join(bin, 'uname'), `#!/bin/sh
if [ "${'$'}{1:-}" = '-s' ]; then printf Linux; else printf x86_64; fi
`);
  writeExecutable(join(bin, 'docker'), '#!/bin/sh\nexit 1\n');
  writeExecutable(
    join(bin, 'curl'),
    `#!/bin/sh
printf called > "$TEST_CURL_MARKER"
exit 1
`,
  );
  const result = spawnSync('sh', [new URL('install.sh', root).pathname], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
      TEST_CURL_MARKER: curlMarker,
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Docker Compose plugin недоступен/u);
  assert.equal(spawnSync('test', ['!', '-e', curlMarker]).status, 0);
});

test('post-checksum archive and runtime failures are explicit', () => {
  const source = bootstrap();
  assert.match(source, /tar -tzf "\$WORK_DIR\/\$ARTIFACT" >"\$ARCHIVE_LIST"/u);
  assert.doesNotMatch(source, /tar -tzf[^\n]+\|\s*awk/u);
  assert.match(source, /Не удалось прочитать структуру artifact/u);
  assert.match(source, /Не удалось распаковать MarMic Server runtime/u);
  assert.match(source, /cat "\$WORK_DIR\/tar\.log"/u);
  assert.match(source, /Установка MarMic Server завершилась с ошибкой/u);
});

function runStagingFailure({ availableKib = null, tempRoot, stagingRoot } = {}) {
  const directory = mkdtempSync(join(tempRoot ?? tmpdir(), 'marmic-staging-'));
  const bin = join(directory, 'bin');
  const trace = join(directory, 'curl-path');
  const mktempTrace = join(directory, 'mktemp-template');
  spawnSync('mkdir', ['-p', bin], { stdio: 'inherit' });
  writeExecutable(
    join(bin, 'curl'),
    `#!/bin/sh
output=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = '--output' ]; then output="$2"; shift 2; else shift; fi
done
printf '%s' "$output" > "$FAKE_CURL_TRACE"
printf partial > "$output"
exit 18
`,
  );
  if (stagingRoot === undefined) {
    writeExecutable(
      join(bin, 'mktemp'),
      `#!/bin/sh
for value in "$@"; do template="$value"; done
printf '%s' "$template" > "$FAKE_MKTEMP_TRACE"
work_dir="$FAKE_WORK_DIRECTORY"
mkdir -p "$work_dir"
printf '%s\n' "$work_dir"
`,
    );
  }
  if (availableKib !== null) {
    writeExecutable(
      join(bin, 'df'),
      `#!/bin/sh
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n'
printf 'fake 1000000 999000 ${availableKib} 99%% /fake\n'
`,
    );
  }
  const env = {
    ...process.env,
    PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
    TMPDIR: tempRoot ?? directory,
    FAKE_CURL_TRACE: trace,
    FAKE_MKTEMP_TRACE: mktempTrace,
    FAKE_WORK_DIRECTORY: join(directory, 'work'),
    MARMIC_BOOTSTRAP_VERIFY_ONLY: '1',
    ...(stagingRoot === undefined
      ? {}
      : { MARMIC_BOOTSTRAP_STAGING_ROOT: stagingRoot }),
  };
  const result = spawnSync('sh', [new URL('install.sh', root).pathname], {
    encoding: 'utf8',
    env,
  });
  return { directory, mktempTrace, result, trace };
}

test('constrained TMPDIR is not used for the large runtime staging', () => {
  const constrainedTmp = mkdtempSync(join(tmpdir(), 'marmic-tmpfs-'));
  const { mktempTrace, result } = runStagingFailure({
    tempRoot: constrainedTmp,
  });
  assert.notEqual(result.status, 0);
  assert.match(
    readFileSync(mktempTrace, 'utf8'),
    /^\/var\/tmp\/marmic-bootstrap\./u,
  );
});

test('an explicit normal disk-backed staging root is honored', () => {
  const stagingRoot = mkdtempSync(join(tmpdir(), 'marmic-disk-staging-'));
  const { result, trace } = runStagingFailure({ stagingRoot });
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(trace, 'utf8').startsWith(stagingRoot), true);
  assert.deepEqual(readdirSync(stagingRoot), []);
});

test('insufficient space on the exact staging filesystem fails before download', () => {
  const stagingRoot = mkdtempSync(join(tmpdir(), 'marmic-small-staging-'));
  const { result, trace } = runStagingFailure({
    availableKib: 128 * 1024,
    stagingRoot,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Недостаточно места/u);
  assert.match(result.stderr, /требуется не менее 1024 MiB/u);
  assert.match(result.stderr, /доступно 128 MiB/u);
  assert.equal(spawnSync('test', ['!', '-e', trace]).status, 0);
  assert.deepEqual(readdirSync(stagingRoot), []);
});

function runExtraction(mode) {
  const directory = mkdtempSync(join(tmpdir(), 'marmic-extract-'));
  const bin = join(directory, 'bin');
  const stagingRoot = join(directory, 'staging');
  const nodeMarker = join(directory, 'node-checked');
  const sha = pinnedSha();
  assert.match(sha, /^[a-f0-9]{64}$/u);
  spawnSync('mkdir', ['-p', bin, stagingRoot], { stdio: 'inherit' });
  writeExecutable(
    join(bin, 'curl'),
    `#!/bin/sh
output=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = '--output' ]; then output="$2"; shift 2; else shift; fi
done
case "$output" in
  *.sha256.part) printf '${sha}  marmic-server-0.13.6-linux-amd64.tar.gz\n' > "$output" ;;
  *) printf artifact > "$output" ;;
esac
`,
  );
  writeExecutable(
    join(bin, 'sha256sum'),
    `#!/bin/sh
printf '${sha}  %s\n' "$1"
`,
  );
  writeExecutable(
    join(bin, 'tar'),
    `#!/bin/sh
if [ "$1" = '-tzf' ]; then
  printf 'marmic-server-0.13.6-linux-amd64/\n'
  printf 'marmic-server-0.13.6-linux-amd64/manifest.json\n'
  exit 0
fi
if [ "$FAKE_TAR_MODE" = 'term' ]; then
  kill -TERM "$PPID"
  exit 143
fi
if [ "$FAKE_TAR_MODE" = 'enospc' ]; then
  echo 'tar: marmic-server runtime: Cannot write: No space left on device' >&2
  exit 2
fi
destination=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = '-C' ]; then destination="$2"; shift 2; else shift; fi
done
mkdir -p "$destination/marmic-server-0.13.6-linux-amd64"
printf '{"version":"0.13.6","architecture":"amd64","sourceCommit":"test"}\n' > "$destination/marmic-server-0.13.6-linux-amd64/manifest.json"
`,
  );
  writeExecutable(
    join(bin, 'node'),
    `#!/bin/sh
for value in "$@"; do manifest="$value"; done
work_dir="$(dirname "$(dirname "$manifest")")"
if find "$work_dir" -maxdepth 1 -name '*.tar.gz' | grep -q .; then
  echo 'compressed artifact still present' >&2
  exit 9
fi
printf checked > "$FAKE_NODE_MARKER"
`,
  );
  const result = spawnSync('sh', [new URL('install.sh', root).pathname], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
      FAKE_NODE_MARKER: nodeMarker,
      FAKE_TAR_MODE: mode,
      MARMIC_BOOTSTRAP_STAGING_ROOT: stagingRoot,
      MARMIC_BOOTSTRAP_VERIFY_ONLY: '1',
    },
  });
  return { nodeMarker, result, stagingRoot };
}

test('tar ENOSPC stderr is preserved and failed extraction is cleaned', () => {
  const { result, stagingRoot } = runExtraction('enospc');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Не удалось распаковать/u);
  assert.match(result.stderr, /No space left on device/u);
  assert.deepEqual(readdirSync(stagingRoot), []);
});

test('SIGTERM during extraction returns 143 and cleans staging', () => {
  const { result, stagingRoot } = runExtraction('term');
  assert.equal(result.status, 143);
  assert.deepEqual(readdirSync(stagingRoot), []);
});

test('compressed artifact is removed immediately after extraction', () => {
  const { nodeMarker, result, stagingRoot } = runExtraction('success');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(nodeMarker, 'utf8'), 'checked');
  assert.deepEqual(readdirSync(stagingRoot), []);
});

test('bootstrap never activates a partially downloaded runtime artifact', () => {
  const directory = mkdtempSync(join(tmpdir(), 'marmic-bootstrap-partial-'));
  const bin = join(directory, 'bin');
  const stagingRoot = join(directory, 'staging');
  spawnSync('mkdir', ['-p', bin], { stdio: 'inherit' });
  writeExecutable(
    join(bin, 'curl'),
    `#!/bin/sh
set -eu
output=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = '--output' ]; then output="$2"; shift 2; else shift; fi
done
printf partial > "$output"
exit 18
`,
  );
  const result = spawnSync('sh', [new URL('install.sh', root).pathname], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
      MARMIC_DISTRIBUTION_BASE_URL: 'https://updates.invalid',
      MARMIC_BOOTSTRAP_STAGING_ROOT: stagingRoot,
      MARMIC_BOOTSTRAP_VERIFY_ONLY: '1',
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Установка MarMic Server не изменена/u);
  assert.match(result.stdout, /скачиваем runtime artifact/u);
});
