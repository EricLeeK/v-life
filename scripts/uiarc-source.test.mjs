import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('Arc sources match the pinned snapshot or their documented local patch', () => {
  const manifest = JSON.parse(read('src/vendor/uiarc/provenance.json'));
  assert.equal(manifest.commit, 'b454cf80c5378d9d1ef846fe1c352e3068281b8d');
  assert.ok(manifest.files.length > 25, 'component CSS and shared tokens must be included');
  for (const file of manifest.files) {
    if (file.localPatch) {
      assert.equal(file.path, 'registry/components/date-range-picker/date-range-picker.tsx');
      assert.ok(file.localPatch.reason);
    }
    assert.equal(hash(read(`src/vendor/uiarc/${file.path}`)), file.localPatch?.sha256 ?? file.sha256, file.path);
  }
});

test('Arc uses the upstream React and animation runtime versions', () => {
  const pkg = JSON.parse(read('package.json'));
  for (const [name, version] of Object.entries({ react: '19.3.0', 'react-dom': '19.3.0', motion: '13.4.0', 'lucide-react': '1.47.0', '@radix-ui/react-dialog': '1.1.23' })) {
    assert.equal(pkg.dependencies[name], version, name);
  }
});

test('Arc foundation does not disable focus outlines outside the Arc component boundary', () => {
  const css = read('src/styles/arc-foundation.scoped.css').toString();
  assert.doesNotMatch(css, /^:is\(\*:focus/m);
  assert.match(css, /\.arc-runtime :is\(\*:focus, \*:focus-visible, \*:focus-within\)/);
});
