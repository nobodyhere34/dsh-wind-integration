/**
 * Delivery gate tests: pure validator (temp dirs, injected deps, no network)
 * plus registration against a structural context stand-in.
 * Runs against the built ../lib/delivery-check.js (build first).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  deliveryCheck, deliveryCheckRender, registerDeliveryCheck,
  DELIVERY_EVIDENCE_KINDS,
} from '../lib/delivery-check.js'

/** Injected deps over one temp dir; smoke runner optional. */
function depsFor(dir, smoke) {
  return {
    cwd: dir,
    exists(file) {
      try {
        const st = statSync(file)
        return { exists: true, isFile: st.isFile(), size: st.size, mtime: st.mtime.toISOString() }
      } catch {
        return { exists: false, isFile: false, size: 0 }
      }
    },
    readFile: (file) => readFileSync(file),
    ...(smoke ? { smoke } : {}),
  }
}

/** One temp dir per test, removed afterwards. */
function withDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'wind-delivery-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

test('missing file parameter fails with the file-path check', async (t) => {
  const dir = withDir(t)
  const v = await deliveryCheck({}, depsFor(dir))
  assert.equal(v.ok, false)
  assert.equal(v.checks.length, 1)
  assert.equal(v.checks[0].name, 'file-path')
  assert.equal(v.checks[0].pass, false)
  assert.match(v.checks[0].detail, /missing file parameter/)
})

test('missing deliverable file fails file-exists (early return)', async (t) => {
  const dir = withDir(t)
  const v = await deliveryCheck({ file: 'nope.txt' }, depsFor(dir))
  assert.equal(v.ok, false)
  assert.equal(v.checks.length, 1)
  assert.equal(v.checks[0].name, 'file-exists')
  assert.equal(v.checks[0].pass, false)
})

test('non-empty utf8 file passes the three file checks', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'ok.md')
  writeFileSync(file, 'hello 世界\n')
  const v = await deliveryCheck({ file }, depsFor(dir))
  assert.equal(v.ok, false) // evidence is missing below — file checks alone cannot PASS the gate
  const names = v.checks.map((c) => c.name)
  assert.ok(names.indexOf('file-exists') >= 0 && names.indexOf('file-nonempty') >= 0 && names.indexOf('encoding-utf8') >= 0)
  for (const name of ['file-exists', 'file-nonempty', 'encoding-utf8']) {
    const c = v.checks.find((x) => x.name === name)
    assert.equal(c.pass, true, name)
  }
})

test('empty file fails file-nonempty', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'empty.txt')
  writeFileSync(file, '')
  const v = await deliveryCheck({ file }, depsFor(dir))
  const c = v.checks.find((x) => x.name === 'file-nonempty')
  assert.ok(c)
  assert.equal(c.pass, false)
  assert.match(c.detail, /0 bytes/)
  assert.equal(v.ok, false)
})

test('invalid utf8 bytes fail encoding-utf8', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'bad.bin')
  writeFileSync(file, Buffer.from([0xff, 0xfe, 0x41]))
  const v = await deliveryCheck({ file }, depsFor(dir))
  const c = v.checks.find((x) => x.name === 'encoding-utf8')
  assert.ok(c)
  assert.equal(c.pass, false)
  assert.equal(v.ok, false)
})

test('missing evidence items fail delivery-evidence', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'ok.txt')
  writeFileSync(file, 'content')
  const noParam = await deliveryCheck({ file }, depsFor(dir))
  const c1 = noParam.checks.find((x) => x.name === 'delivery-evidence')
  assert.ok(c1)
  assert.equal(c1.pass, false)
  assert.match(c1.detail, /missing evidence items/)
  const emptyItems = await deliveryCheck({ file, evidence: { items: [] } }, depsFor(dir))
  const c2 = emptyItems.checks.find((x) => x.name === 'delivery-evidence')
  assert.equal(c2.pass, false)
  assert.equal(emptyItems.ok, false)
})

test('page without an injected smoke runner fails headless-smoke', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'index.html')
  writeFileSync(file, '<html><body>hi</body></html>')
  const v = await deliveryCheck({ file, url: 'http://127.0.0.1:9999/x' }, depsFor(dir))
  const c = v.checks.find((x) => x.name === 'headless-smoke')
  assert.ok(c)
  assert.equal(c.pass, false)
  assert.match(c.detail, /no smoke runner injected/)
  assert.equal(v.ok, false)
})

test('page smoke: runner failure fails, runner ok passes, requireSmoke:false skips', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'index.html')
  writeFileSync(file, '<html><body>hi</body></html>')
  const failing = await deliveryCheck({ file, url: 'http://x' }, depsFor(dir, async () => ({ ok: false, detail: 'net::ERR_CONNECTION_REFUSED' })))
  const cf = failing.checks.find((x) => x.name === 'headless-smoke')
  assert.equal(cf.pass, false)
  assert.match(cf.detail, /smoke FAIL/)
  assert.equal(failing.ok, false)

  const events = []
  const passing = await deliveryCheck(
    { file, url: 'http://x', evidence: { items: [{ label: 'shot', kind: 'page', target: file, reviewed: true }] } },
    depsFor(dir, async (url, opts) => { events.push([url, opts]); return { ok: true, detail: '200 in 320ms' } }),
  )
  const cp = passing.checks.find((x) => x.name === 'headless-smoke')
  assert.equal(cp.pass, true)
  assert.match(cp.detail, /smoke OK/)
  assert.equal(events.length, 1)
  assert.equal(events[0][0], 'http://x')
  assert.deepEqual(events[0][1], { timeoutMs: undefined, virtualTimeMs: undefined, retry: undefined })

  const skipped = await deliveryCheck(
    { file, url: 'http://x', requireSmoke: false, evidence: { items: [{ label: 'shot', kind: 'page', target: file, reviewed: true }] } },
    depsFor(dir),
  )
  assert.ok(!skipped.checks.some((x) => x.name === 'headless-smoke'))
  assert.equal(skipped.ok, true) // smoke skipped by explicit escape, all else green
})

test('image without reviewed fails with visual not reviewed', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'shot.png')
  const ref = join(dir, 'shot_ref.png')
  writeFileSync(file, 'png-bytes')
  writeFileSync(ref, 'png-bytes')
  const v = await deliveryCheck(
    { file, evidence: { items: [{ label: 'ui', kind: 'image', target: ref }] } },
    depsFor(dir),
  )
  const c = v.checks.find((x) => x.name === 'delivery-evidence')
  assert.equal(c.pass, false)
  assert.match(c.detail, /visual not reviewed: ui/)
  assert.equal(v.ok, false)
})

test('page needs at least one reviewed visual evidence', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'index.html')
  const log = join(dir, 'build.log')
  writeFileSync(file, '<html></html>')
  writeFileSync(log, 'compiled ok')
  const deps = depsFor(dir, async () => ({ ok: true }))
  // file-only evidence: no reviewed visual → FAIL
  const onlyFile = await deliveryCheck(
    { file, url: 'http://x', evidence: { items: [{ label: 'log', kind: 'file', target: log }] } },
    deps,
  )
  const c1 = onlyFile.checks.find((x) => x.name === 'delivery-evidence')
  assert.equal(c1.pass, false)
  assert.match(c1.detail, /reviewed visual evidence/)
  // reviewed external evidence satisfies the visual rule
  const withExternal = await deliveryCheck(
    { file, url: 'http://x', evidence: { items: [{ label: 'external', kind: 'external', result: 'deployed to https://x', reviewed: true }] } },
    deps,
  )
  assert.equal(withExternal.ok, true)
})

test('run/text evidence without result fails', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'ok.txt')
  writeFileSync(file, 'x')
  for (const kind of ['run', 'text']) {
    const v = await deliveryCheck({ file, evidence: { items: [{ label: kind, kind }] } }, depsFor(dir))
    const c = v.checks.find((x) => x.name === 'delivery-evidence')
    assert.equal(c.pass, false, kind)
    assert.match(c.detail, new RegExp(kind + ' evidence without result'))
  }
})

test('external evidence needs target or result', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'ok.txt')
  writeFileSync(file, 'x')
  const none = await deliveryCheck(
    { file, evidence: { items: [{ label: 'e', kind: 'external' }] } },
    depsFor(dir),
  )
  const c = none.checks.find((x) => x.name === 'delivery-evidence')
  assert.equal(c.pass, false)
  assert.match(c.detail, /external evidence needs target/)
  // missing target file fails; valid target passes
  const missingTarget = await deliveryCheck(
    { file, evidence: { items: [{ label: 'e', kind: 'external', target: join(dir, 'absent.txt') }] } },
    depsFor(dir),
  )
  assert.match(missingTarget.checks.find((x) => x.name === 'delivery-evidence').detail, /external target missing/)
  const okResult = await deliveryCheck(
    { file, evidence: { items: [{ label: 'e', kind: 'external', result: 'summary: done' }] } },
    depsFor(dir),
  )
  assert.equal(okResult.ok, true)
})

test('numeric evidence requires a numeric result; passes on numbers', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'ok.txt')
  writeFileSync(file, 'x')
  const bad = await deliveryCheck(
    { file, evidence: { items: [{ label: 'metric', kind: 'numeric', result: 'fast' }] } },
    depsFor(dir),
  )
  const cb = bad.checks.find((x) => x.name === 'delivery-evidence')
  assert.equal(cb.pass, false)
  assert.match(cb.detail, /numeric evidence needs a numeric result/)
  const missing = await deliveryCheck(
    { file, evidence: { items: [{ label: 'metric', kind: 'numeric' }] } },
    depsFor(dir),
  )
  assert.equal(missing.ok, false)
  // the example text 'minr=2.07, H=0.00' lives INSIDE the error detail — the
  // result itself must be a bare number (upstream regex /^-?[\d.eE+-]+$/)
  const good = await deliveryCheck(
    { file, evidence: { items: [{ label: 'metric', kind: 'numeric', result: '-2.07e3' }] } },
    depsFor(dir),
  )
  assert.equal(good.ok, true)
})

test('unknown evidence kind fails with bad kind', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'ok.txt')
  writeFileSync(file, 'x')
  const v = await deliveryCheck(
    { file, evidence: { items: [{ label: 'a', kind: 'video' }] } },
    depsFor(dir),
  )
  const c = v.checks.find((x) => x.name === 'delivery-evidence')
  assert.equal(c.pass, false)
  assert.match(c.detail, /bad kind: video/)
})

test('empty label and non-file evidence target fail', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'ok.txt')
  writeFileSync(file, 'x')
  const emptyLabel = await deliveryCheck(
    { file, evidence: { items: [{ label: '   ', kind: 'file', target: file }] } },
    depsFor(dir),
  )
  assert.match(emptyLabel.checks.find((x) => x.name === 'delivery-evidence').detail, /empty label/)
  const badTarget = await deliveryCheck(
    { file, evidence: { items: [{ label: 'a', kind: 'file', target: join(dir, 'absent.txt') }] } },
    depsFor(dir),
  )
  assert.match(badTarget.checks.find((x) => x.name === 'delivery-evidence').detail, /target missing/)
  const zeroTarget = join(dir, 'zero.txt')
  writeFileSync(zeroTarget, '')
  const zero = await deliveryCheck(
    { file, evidence: { items: [{ label: 'a', kind: 'test', target: zeroTarget }] } },
    depsFor(dir),
  )
  assert.match(zero.checks.find((x) => x.name === 'delivery-evidence').detail, /target not valid file/)
})

test('relative evidence targets resolve against deps.cwd', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'ok.txt')
  const rel = join(dir, 'rel.txt')
  writeFileSync(file, 'x')
  writeFileSync(rel, 'y')
  const v = await deliveryCheck(
    { file, evidence: { items: [{ label: 'a', kind: 'file', target: 'rel.txt' }] } },
    depsFor(dir),
  )
  assert.equal(v.ok, true)
})

test('overall PASS only when every check passes; any break fails (no bypass)', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'ok.txt')
  writeFileSync(file, 'content 内容')
  const goodDeps = depsFor(dir, async () => ({ ok: true }))
  const good = await deliveryCheck(
    { file, url: 'http://x', evidence: { items: [{ label: 'file', kind: 'file', target: file }, { label: 'page', kind: 'page', target: file, reviewed: true }, { label: 'm', kind: 'numeric', result: '1.0' }] } },
    goodDeps,
  )
  assert.equal(good.ok, true)
  // a numeric evidence item suppresses the non-blocking numeric-assertion hint
  assert.deepEqual(good.checks.map((c) => c.name), ['file-exists', 'file-nonempty', 'encoding-utf8', 'headless-smoke', 'delivery-evidence'])
  // without a numeric item the hint appears (and stays non-blocking)
  const hinted = await deliveryCheck(
    { file, url: 'http://x', evidence: { items: [{ label: 'file', kind: 'file', target: file }, { label: 'page', kind: 'page', target: file, reviewed: true }] } },
    goodDeps,
  )
  const hint = hinted.checks.find((c) => c.name === 'numeric-assertion')
  assert.ok(hint && hint.pass === true)

  const cases = [
    ['empty file', { file: join(dir, 'zero.txt'), evidence: { items: [{ label: 'f', kind: 'file', target: file }] } }],
    ['bad utf8', { file: join(dir, 'bad.bin'), evidence: { items: [{ label: 'f', kind: 'file', target: file }] } }],
    ['missing file', { file: join(dir, 'absent.txt'), evidence: { items: [{ label: 'f', kind: 'file', target: file }] } }],
    ['missing evidence', { file }],
    ['bad evidence', { file, evidence: { items: [{ label: 'x', kind: 'nope' }] } }],
    ['failing smoke', { file, url: 'http://x', evidence: { items: [{ label: 'f', kind: 'file', target: file }] } }],
  ]
  writeFileSync(join(dir, 'zero.txt'), '')
  writeFileSync(join(dir, 'bad.bin'), Buffer.from([0xff, 0xfe]))
  for (const [name, args] of cases) {
    const v = await deliveryCheck(args, goodDeps)
    assert.equal(v.ok, false, name + ' must FAIL the gate')
    assert.ok(v.checks.some((c) => !c.pass), name + ' must carry the failing check')
  }
})

test('deliveryCheckRender carries the PASS/FAIL contract', () => {
  const pass = deliveryCheckRender({}, { ok: true, checks: [{ name: 'file-exists', pass: true, detail: 'x' }] })
  assert.equal(pass[0].type, 'text')
  assert.match(pass[0].text, /PASS/)
  assert.match(pass[0].text, /All checks passed — delivery gate satisfied/)
  const fail = deliveryCheckRender({}, { ok: false, checks: [{ name: 'encoding-utf8', pass: false, detail: 'y' }] })
  assert.match(fail[0].text, /FAIL/)
  assert.match(fail[0].text, /do NOT report completion/)
})

test('kind set matches upstream (8 kinds, exact order)', () => {
  assert.deepEqual(DELIVERY_EVIDENCE_KINDS, ['file', 'page', 'image', 'run', 'test', 'text', 'external', 'numeric'])
})

test('registerDeliveryCheck registers delivery_check; execute returns a verdict', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'ok.txt')
  writeFileSync(file, 'x')
  const registered = []
  const disposers = []
  const fakeCtx = {
    tools: { register: (def) => { registered.push(def); return def } },
    effect: (fn, label) => { disposers.push(label); const r = fn(); return () => r },
  }
  const dispose = registerDeliveryCheck(fakeCtx, depsFor(dir, async () => ({ ok: true })))
  assert.equal(registered.length, 1)
  const def = registered[0]
  assert.equal(def.name, 'delivery_check')
  assert.match(def.description, /delivery_check/)
  assert.deepEqual(disposers, ['dsh-wind: delivery_check'])
  assert.equal(typeof dispose, 'function')
  // compiled JSON-schema parameters: file required, evidence object closed, kinds enum
  assert.equal(def.parameters.type, 'object')
  assert.ok(def.parameters.required.includes('file'))
  assert.ok(def.parameters.required.includes('evidence'))
  assert.equal(def.parameters.properties.evidence.additionalProperties, false)
  assert.deepEqual(def.parameters.properties.evidence.properties.items.items.properties.kind.enum, DELIVERY_EVIDENCE_KINDS)
  // execute runs the pure validator through the injected deps
  const verdict = await def.execute(
    { file, url: 'http://x', evidence: { items: [{ label: 'shot', kind: 'page', target: file, reviewed: true }] } },
    {},
  )
  assert.equal(verdict.ok, true)
  assert.ok(verdict.checks.some((c) => c.name === 'headless-smoke' && c.pass))
  // render is wired into the output
  const rendered = def.output.render({}, verdict)
  assert.match(rendered[0].text, /PASS ✅/)
})

test('registerDeliveryCheck without ctx.effect registers directly', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'ok.txt')
  writeFileSync(file, 'x')
  let count = 0
  const dispose = registerDeliveryCheck({ tools: { register: () => { count += 1; return 1 } } }, depsFor(dir))
  assert.equal(count, 1)
  assert.equal(typeof dispose, 'function')
  assert.equal(dispose(), undefined)
})

test('validator never touches the network (deps fully injected)', async (t) => {
  const dir = withDir(t)
  const file = join(dir, 'ok.txt')
  writeFileSync(file, 'x')
  const deps = depsFor(dir, async () => ({ ok: true }))
  const v = await deliveryCheck(
    { file, url: 'http://example.test/p', evidence: { items: [{ label: 's', kind: 'page', target: file, reviewed: true }, { label: 'n', kind: 'numeric', result: '0.00' }] } },
    deps,
  )
  assert.equal(v.ok, true)
})
