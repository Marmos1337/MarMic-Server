import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

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
  const bootstrap = read('install.sh');
  assert.match(bootstrap, /VERSION="0\.13\.4"/u);
  assert.match(bootstrap, /--retry 4/u);
  assert.match(bootstrap, /--retry-all-errors/u);
  assert.match(bootstrap, /--connect-timeout 15/u);
  assert.match(bootstrap, /--max-time 1200/u);
  assert.match(bootstrap, /destination\.part/u);
  assert.match(bootstrap, /mv "\$partial" "\$destination"/u);
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
  const bootstrap = read('install.sh');
  assert.match(bootstrap, /tar -tzf "\$WORK_DIR\/\$ARTIFACT" >"\$ARCHIVE_LIST"/u);
  assert.doesNotMatch(bootstrap, /tar -tzf[^\n]+\|\s*awk/u);
  assert.match(bootstrap, /Не удалось прочитать структуру artifact/u);
  assert.match(bootstrap, /Не удалось распаковать MarMic Server runtime/u);
  assert.match(bootstrap, /Установка MarMic Server завершилась с ошибкой/u);
});

test('bootstrap never activates a partially downloaded runtime artifact', () => {
  const directory = mkdtempSync(join(tmpdir(), 'marmic-bootstrap-partial-'));
  const bin = join(directory, 'bin');
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
      MARMIC_BOOTSTRAP_VERIFY_ONLY: '1',
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Установка MarMic Server не изменена/u);
  assert.match(result.stdout, /скачиваем runtime artifact/u);
});
