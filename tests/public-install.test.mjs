import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const bootstrap = read('install.sh');
const version = /VERSION="([^"]+)"/u.exec(bootstrap)?.[1];
const sourceCommit = /SOURCE_COMMIT="([^"]+)"/u.exec(bootstrap)?.[1];
const pinnedSha = /PINNED_SHA256="([^"]+)"/u.exec(bootstrap)?.[1];

function canonicalCommand(markdown) {
  const match = /```bash\r?\n(sh -c '[^\r\n]+')\r?\n```/u.exec(markdown);
  assert.ok(match, 'canonical non-piped installer command is missing');
  return match[1];
}
function executable(path, contents) {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'marmic-public-install-0180-'));
  const bin = join(directory, 'bin');
  const staging = join(directory, 'staging');
  mkdirSync(bin);
  mkdirSync(staging);
  return { directory, bin, staging };
}
function runCanonical(mode) {
  const f = fixture();
  const marker = join(f.directory, 'installed');
  const trace = join(f.directory, 'download-path');
  executable(
    join(f.bin, 'curl'),
    `#!/bin/sh
set -eu
output=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = '--output' ]; then output="$2"; shift 2; else shift; fi
done
printf '%s' "$output" > "$FAKE_CURL_TRACE"
if [ "$FAKE_CURL_MODE" = partial ]; then printf '#!/bin/sh\n' > "$output"; exit 18; fi
printf '#!/bin/sh\nprintf installed > "$TEST_INSTALL_MARKER"\n' > "$output"
`,
  );
  executable(join(f.bin, 'sudo'), '#!/bin/sh\nexec "$@"\n');
  const result = spawnSync('sh', ['-c', canonicalCommand(read('README.md'))], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${f.bin}${delimiter}${process.env.PATH}`,
      FAKE_CURL_MODE: mode,
      FAKE_CURL_TRACE: trace,
      TEST_INSTALL_MARKER: marker,
    },
  });
  return { result, marker, downloaded: readFileSync(trace, 'utf8') };
}

test('README and guides retain one quoted, non-piped, complete-download command', () => {
  const expected = canonicalCommand(read('README.md'));
  assert.equal(canonicalCommand(read('docs/installation.md')), expected);
  assert.equal(canonicalCommand(read('docs/home-server.md')), expected);
  assert.doesNotMatch(expected, /\|\s*(?:sudo\s+)?sh\b/u);
  assert.match(expected, /--output "\$tmp"/u);
  assert.match(expected, /\[ ! -s "\$tmp" \]/u);
  assert.match(expected, /sudo sh "\$tmp"/u);
});
test('canonical command executes only a complete download and cleans its temporary file', () => {
  const r = runCanonical('valid');
  assert.equal(r.result.status, 0, r.result.stderr);
  assert.equal(readFileSync(r.marker, 'utf8'), 'installed');
  assert.equal(existsSync(r.downloaded), false);
});
test('interrupted canonical download never executes', () => {
  const r = runCanonical('partial');
  assert.notEqual(r.result.status, 0);
  assert.match(r.result.stderr, /Не удалось полностью скачать/u);
  assert.equal(existsSync(r.marker), false);
  assert.equal(existsSync(r.downloaded), false);
});
test('immutable bootstrap pins exact version, source, archive SHA and HTTPS', () => {
  assert.equal(version, '0.18.3');
  assert.equal(sourceCommit, '6fa59d1c820071a98093f383b501fc82543adabd');
  assert.match(pinnedSha, /^[a-f0-9]{64}$/u);
  assert.ok(read('README.md').includes(pinnedSha));
  assert.ok(
    read('README.md').includes(
      createHash('sha256').update(bootstrap).digest('hex'),
    ),
  );
  assert.match(
    bootstrap,
    /--proto "\$curl_protocols" --proto-redir "\$curl_protocols"/u,
  );
  assert.match(bootstrap, /--retry 4 --retry-all-errors/u);
  assert.match(bootstrap, /--connect-timeout 15 --max-time 1200/u);
  assert.match(bootstrap, /mv "\$partial" "\$WORK_DIR\/\$ARTIFACT"/u);
  assert.doesNotMatch(bootstrap, /\r/u);
});

function runBootstrap(mode = 'valid', extra = {}) {
  const f = fixture();
  const trace = join(f.directory, 'curl-path');
  const tarTrace = join(f.directory, 'tar-called');
  const payload = `marmic-server-${version}-linux-amd64`;
  executable(
    join(f.bin, 'curl'),
    `#!/bin/sh
set -eu
output=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = '--output' ]; then output="$2"; shift 2; else shift; fi
done
printf '%s' "$output" > "$FAKE_CURL_TRACE"
printf artifact > "$output"
if [ "$FAKE_MODE" = partial ]; then exit 18; fi
`,
  );
  executable(
    join(f.bin, 'sha256sum'),
    `#!/bin/sh
if [ "$FAKE_MODE" = hash ]; then printf '${'0'.repeat(64)}'; else printf '${pinnedSha}'; fi
printf '  %s\n' "$1"
`,
  );
  executable(
    join(f.bin, 'tar'),
    `#!/bin/sh
set -eu
printf called > "$FAKE_TAR_TRACE"
case "$1" in
  -tzf)
    if [ "$FAKE_MODE" = traversal ]; then printf '../outside\n'; else printf '${payload}/\n${payload}/manifest.json\n'; fi
    exit 0 ;;
  -tvzf)
    if [ "$FAKE_MODE" = symlink ]; then printf 'lrwxrwxrwx root/root 0 link\n'; else printf -- '-rw-r--r-- root/root 1 manifest.json\n'; fi
    exit 0 ;;
esac
if [ "$FAKE_MODE" = enospc ]; then echo 'tar: No space left on device' >&2; exit 2; fi
if [ "$FAKE_MODE" = term ]; then kill -TERM "$PPID"; exit 143; fi
destination=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = '-C' ]; then destination="$2"; shift 2; else shift; fi
done
mkdir -p "$destination/${payload}/runtime"
commit='${sourceCommit}'
if [ "$FAKE_MODE" = manifest ]; then commit=wrong; fi
printf '{"version":"${version}","sourceCommit":"%s"}\n' "$commit" > "$destination/${payload}/manifest.json"
printf '#!/bin/sh\nexec ${process.execPath} "$@"\n' > "$destination/${payload}/runtime/node"
chmod 0755 "$destination/${payload}/runtime/node"
`,
  );
  const staging = extra.relative ? 'relative-path' : f.staging;
  if (extra.symlinkRoot) {
    const link = join(f.directory, 'staging-link');
    symlinkSync(f.staging, link);
    extra.MARMIC_BOOTSTRAP_STAGING_ROOT = link;
  }
  const result = spawnSync('sh', [new URL('install.sh', root).pathname], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${f.bin}${delimiter}${process.env.PATH}`,
      FAKE_MODE: mode,
      FAKE_CURL_TRACE: trace,
      FAKE_TAR_TRACE: tarTrace,
      MARMIC_BOOTSTRAP_VERIFY_ONLY: '1',
      MARMIC_BOOTSTRAP_STAGING_ROOT: staging,
      ...extra,
    },
  });
  return { ...f, result, trace, tarTrace };
}
test('valid immutable payload verifies identity and cleans disk-backed staging', () => {
  const r = runBootstrap();
  assert.equal(r.result.status, 0, r.result.stderr);
  assert.match(
    r.result.stdout,
    /Pinned MarMic Server 0\.18\.3 archive verified/u,
  );
  assert.ok(readFileSync(r.trace, 'utf8').startsWith(r.staging));
  assert.deepEqual(readdirSync(r.staging), []);
});
for (const [mode, expected] of [
  ['hash', /SHA-256 mismatch/u],
  ['traversal', /unsafe paths/u],
  ['symlink', /unsupported links/u],
  ['manifest', /manifest identity mismatch/u],
  ['enospc', /No space left on device/u],
]) {
  test(`rejects ${mode} before runtime activation and cleans staging`, () => {
    const r = runBootstrap(mode);
    assert.notEqual(r.result.status, 0);
    assert.match(r.result.stderr, expected);
    assert.deepEqual(readdirSync(r.staging), []);
    if (mode === 'hash') assert.equal(existsSync(r.tarTrace), false);
  });
}
test('partial artifact download never reaches extraction', () => {
  const r = runBootstrap('partial');
  assert.equal(r.result.status, 18);
  assert.equal(existsSync(r.tarTrace), false);
  assert.deepEqual(readdirSync(r.staging), []);
});
test('SIGTERM during extraction returns 143 and cleans only fixture staging', () => {
  const r = runBootstrap('term');
  assert.equal(r.result.status, 143);
  assert.deepEqual(readdirSync(r.staging), []);
});
for (const options of [{ relative: true }, { symlinkRoot: true }]) {
  test(`unsafe staging root fails before download: ${Object.keys(options)[0]}`, () => {
    const r = runBootstrap('valid', options);
    assert.notEqual(r.result.status, 0);
    assert.equal(existsSync(r.trace), false);
  });
}
test('untrusted origins and shell-looking input are refused, not executed', () => {
  for (const origin of [
    'https://untrusted.invalid',
    'file:///etc/passwd',
    'https://example.invalid/$(touch /tmp/marmic-should-not-exist)',
  ]) {
    const r = runBootstrap('valid', { MARMIC_DISTRIBUTION_BASE_URL: origin });
    assert.notEqual(r.result.status, 0);
    assert.match(r.result.stderr, /custom distribution origin is forbidden/u);
    assert.equal(existsSync(r.trace), false);
  }
  assert.equal(existsSync('/tmp/marmic-should-not-exist'), false);
});
test('missing Docker Compose is a pre-download error for a real installation', () => {
  const f = fixture();
  executable(join(f.bin, 'id'), '#!/bin/sh\nprintf 0\n');
  executable(
    join(f.bin, 'uname'),
    '#!/bin/sh\nif [ "$1" = -s ]; then printf Linux; else printf x86_64; fi\n',
  );
  executable(join(f.bin, 'docker'), '#!/bin/sh\nexit 1\n');
  const result = spawnSync('sh', [new URL('install.sh', root).pathname], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${f.bin}${delimiter}${process.env.PATH}`,
      MARMIC_BOOTSTRAP_VERIFY_ONLY: '0',
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Docker Engine with the Compose plugin is required/u,
  );
});
test('public notices preserve approval, signature enforcement and frozen legacy policy', () => {
  const notes = read('README.md');
  assert.match(notes, /approval_required/u);
  assert.match(notes, /Ed25519/u);
  assert.match(notes, /невалидная подпись/u);
  assert.match(
    notes,
    /legacy unsigned feed stays byte-identical at `0\.16\.21`/iu,
  );
  assert.match(notes, /runtime здесь не публикуется/u);
});

test('0.18.3 release notes bind both signed transition plans and exact public assets', () => {
  const notes = read('docs/releases/0.18.3.md');
  assert.match(notes, /6fa59d1c820071a98093f383b501fc82543adabd/u);
  assert.match(notes, /13e9bd3cfec74c70dd063f5bc940691dcc57f36e/u);
  assert.match(notes, /dad2f01770d81c3d9af6c7a18f46bfc763910c1e730c60b22f2e92130c664f71/u);
  assert.match(notes, /231a8744588977d4eb5619f4efde2d8b2bb5ce0ad52c554922f55f8dd7aed222/u);
  assert.match(notes, /f730382233d1c6454671069fe89d61d4056684a870ce6207c3c23e2bae49c179/u);
  assert.match(notes, /e99095e0d7c6e73a2ae59d6be3d6554bc722b16075a64e37382fdfceb60e34da/u);
  assert.match(notes, /server-update-linux-amd64-postgres\.signed\.json/u);
  assert.match(notes, /approval_required/u);
  assert.match(notes, /pre_traffic_only/u);
  assert.match(notes, /legacy unsigned feed.*0\.16\.21/iu);
});
