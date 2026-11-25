#!/usr/bin/env node
/**
 * Smoke test for the Host half of prism-latex.
 *
 * Loads `src/host.js` with a stand-in Cordis context, then exercises the two
 * registered HTTP resources end to end: a real compile with the default engine,
 * the PNG page payload, the PDF route, and the rejection paths. No DSH host is
 * involved, so this proves the compile pipeline and the wire contract before
 * installation.
 *
 * Usage:
 *   node scripts/smoke-host.mjs [--write-pages <dir>]
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { inflateSync } from 'node:zlib'

const root = resolve(import.meta.dirname, '..')
const pageDirArg = process.argv.indexOf('--write-pages')
const pageOutput = pageDirArg === -1 ? undefined : resolve(process.argv[pageDirArg + 1])
let failures = 0

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok  ${label}`)
    return
  }
  failures += 1
  console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
}

function section(title) {
  console.log(`\n${title}`)
}

const ORIGIN = 'http://127.0.0.1:61896'

/** Collect the routes and effects a plugin registers against a stand-in context. */
function fakeContext() {
  const routes = new Map()
  const services = new Map([
    ['sessions', { get: id => (id === 'smoke-session' ? { header: { cwd: root } } : undefined) }],
    ['sandboxPolicy', { workspaceRoot: root }],
  ])
  return {
    routes,
    services,
    logger: { info() {}, warn() {}, error() {} },
    effect(fn) { return fn() },
    get(name) { return services.get(name) },
    webServer: {
      getOrigin: () => ORIGIN,
      register(route) {
        routes.set(route.path, route)
        return () => { routes.delete(route.path) }
      },
    },
  }
}

function renderUrl(query) {
  return `${ORIGIN}/api/prism-latex/render?${new URLSearchParams(query)}`
}

function pdfUrl(query) {
  return `${ORIGIN}/api/prism-latex/pdf?${new URLSearchParams(query)}`
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
/** The engines the Host accepts, mirroring its list; a response must name one of them. */
const ENGINE_NAMES = ['pdflatex', 'xelatex', 'lualatex', 'latexmk']

/** True when latexmk is installed where the Host's resolver looks for it. */
function hasLatexmk() {
  const directories = String(process.env.PATH ?? '')
    .split(delimiter)
    .filter(entry => entry !== '')
  directories.push('/Library/TeX/texbin', '/opt/homebrew/bin', '/usr/local/bin')
  return directories.some(directory => existsSync(join(directory, 'latexmk')))
}

/**
 * Concatenate a PDF's page content streams so a test can inspect the rendered text.
 *
 * Only streams that open with `BT` (the PDF text object) are read: embedded font
 * programs also contain arbitrary bytes, and a chance "??" inside one must not be
 * mistaken for a rendered unresolved reference.
 *
 * @param bytes - the whole PDF file.
 * @returns the content stream text, or an empty string when there is none.
 */
function pdfStreamText(bytes) {
  const startMarker = Buffer.from('stream')
  const endMarker = Buffer.from('endstream')
  const chunks = []
  let offset = 0
  while ((offset = bytes.indexOf(startMarker, offset)) !== -1) {
    let start = offset + startMarker.length
    if (bytes[start] === 0x0d) start += 1
    if (bytes[start] === 0x0a) start += 1
    const end = bytes.indexOf(endMarker, start)
    if (end === -1) break
    offset = end + endMarker.length
    let content
    try {
      content = inflateSync(bytes.subarray(start, end)).toString('latin1')
    } catch {
      continue
    }
    if (content.trimStart().startsWith('BT')) chunks.push(content)
  }
  return chunks.join('\n')
}

/** Fetch a compiled PDF from the Host's /pdf route and return its text content. */
async function pdfText(route, url) {
  const response = await route.resource(new Request(url))
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') return undefined
  return pdfStreamText(bytes)
}

async function main() {
  section('module shape')
  const module = await import(pathToFileURL(join(root, 'src/host.js')).href)
  check('exports apply()', typeof module.apply === 'function')
  check('declares webServer', JSON.stringify(module.inject ?? []).includes('webServer'),
    String(module.inject))

  section('route registration')
  const ctx = fakeContext()
  module.apply(ctx, { dpi: 144 })
  const render = ctx.routes.get('/api/prism-latex/render')
  const pdf = ctx.routes.get('/api/prism-latex/pdf')
  check('render route registered', render !== undefined)
  check('pdf route registered', pdf !== undefined)
  const files = ctx.routes.get('/api/prism-latex/files')
  check('files route registered', files !== undefined)
  const source = ctx.routes.get('/api/prism-latex/source')
  check('source route registered', source !== undefined)
  const write = ctx.routes.get('/api/prism-latex/write')
  check('write route registered', write !== undefined)
  if (render === undefined || pdf === undefined) return

  section('render demo/example.tex')
  const started = Date.now()
  const response = await render.resource(new Request(renderUrl({
    session: 'smoke-session', path: 'demo/example.tex',
  })))
  const body = await response.json()
  check('HTTP 200', response.status === 200, String(response.status))
  check('ok: true', body.ok === true, JSON.stringify(body).slice(0, 400))
  if (body.ok !== true) {
    console.log(body)
    return
  }
  check('engine reported', typeof body.engine === 'string', String(body.engine))
  check('default engine from the engine list', ENGINE_NAMES.includes(body.engine), String(body.engine))
  // latexmk is the default; it falls back to pdflatex only where it is not installed.
  check('default engine is latexmk (or its fallback)', hasLatexmk()
    ? body.engine === 'latexmk'
    : body.engine === 'pdflatex', String(body.engine))
  check('durationMs reported', typeof body.durationMs === 'number')
  check('pageCount matches pages', body.pageCount === body.pages.length)
  check('version present', typeof body.version === 'string' && body.version.length > 0)
  check('pdfUrl present', typeof body.pdfUrl === 'string' && body.pdfUrl.includes('pdf'))
  check('not truncated', body.truncated === false, String(body.truncated))
  console.log(`      ${body.pageCount} page(s), ${body.engine}, ${body.durationMs} ms`)

  for (const [index, page] of body.pages.entries()) {
    const bytes = Buffer.from(page.png, 'base64')
    check(`page ${index + 1}: PNG signature`, bytes.subarray(0, 8).equals(PNG_MAGIC))
    check(`page ${index + 1}: width/height`, page.width > 100 && page.height > 100,
      `${page.width}x${page.height}`)
  }
  if (pageOutput !== undefined) {
    mkdirSync(pageOutput, { recursive: true })
    for (const [index, page] of body.pages.entries()) {
      const file = join(pageOutput, `page-${String(index + 1).padStart(3, '0')}.png`)
      writeFileSync(file, Buffer.from(page.png, 'base64'))
      console.log(`      wrote ${file}`)
    }
  }

  section('inverse search (synctex)')
  {
    const route = ctx.routes.get('/api/prism-latex/synctex')
    check('synctex route registered', route !== undefined)
    const response = await route.resource(new Request(
      `${ORIGIN}/api/prism-latex/synctex?session=smoke-session&path=demo/showcase.tex&page=1&x=120&y=150`))
    const synctex = await response.json()
    check('synctex resolves a position', synctex.ok === true, JSON.stringify(synctex).slice(0, 300))
    if (synctex.ok === true) {
      check('synctex reports the source file', synctex.path === 'demo/showcase.tex', String(synctex.path))
      check('synctex reports a line', Number.isInteger(synctex.line) && synctex.line >= 1, String(synctex.line))
      check('synctex reports a column', Number.isInteger(synctex.column) && synctex.column >= 0,
        String(synctex.column))
    }
    const missing = await route.resource(new Request(
      `${ORIGIN}/api/prism-latex/synctex?session=smoke-session&path=demo/showcase.tex&page=1`))
    check('synctex requires coordinates', missing.status === 400, String(missing.status))
  }

  section('engine override')
  {
    const explicit = await render.resource(new Request(renderUrl({
      session: 'smoke-session', path: 'demo/example.tex', engine: 'pdflatex',
    })))
    const explicitBody = await explicit.json()
    check('explicit engine honoured', explicitBody.engine === 'pdflatex',
      String(explicitBody.engine))
    const unknown = await render.resource(new Request(renderUrl({
      session: 'smoke-session', path: 'demo/example.tex', engine: 'not-an-engine',
    })))
    const unknownBody = await unknown.json()
    check('unknown engine falls back to the default', unknownBody.engine === body.engine,
      String(unknownBody.engine))
  }

  section('cross references')
  {
    // A table of contents and a \ref only resolve when the engine runs twice; one
    // pdflatex pass leaves "??" on the page, which is exactly what latexmk avoids.
    const referenceName = `.smoke-reference-${process.pid}.tex`
    const referenceFile = join(root, 'demo', referenceName)
    writeFileSync(referenceFile, [
      '\\documentclass{article}',
      '\\begin{document}',
      '\\tableofcontents',
      '\\section{Alpha}\\label{sec:alpha}',
      'See Section~\\ref{sec:alpha}.',
      '\\end{document}',
      '',
    ].join('\n'))
    try {
      const referencePath = `demo/${referenceName}`
      const repeated = await render.resource(new Request(renderUrl({
        session: 'smoke-session', path: referencePath,
      })))
      const repeatedBody = await repeated.json()
      check('reference document compiles', repeatedBody.ok === true,
        JSON.stringify(repeatedBody).slice(0, 300))
      if (repeatedBody.ok === true) {
        const single = await render.resource(new Request(renderUrl({
          session: 'smoke-session', path: referencePath, engine: 'pdflatex',
        })))
        const singleBody = await single.json()
        check('single-pass control compiles', singleBody.ok === true,
          JSON.stringify(singleBody).slice(0, 300))
        if (singleBody.ok === true) {
          if (repeatedBody.engine === 'latexmk') {
            check('resolved contents change page 1 from the single pass',
              repeatedBody.pages?.[0]?.png !== singleBody.pages?.[0]?.png)
            const repeatedText = await pdfText(pdf, pdfUrl({
              session: 'smoke-session', path: referencePath,
            }))
            const singleText = await pdfText(pdf, pdfUrl({
              session: 'smoke-session', path: referencePath, engine: 'pdflatex',
            }))
            check('no unresolved "??" from the default engine',
              repeatedText !== undefined && repeatedText.includes('??') === false,
              JSON.stringify(repeatedText?.slice(0, 160)))
            check('single pass leaves "??" (control)',
              singleText !== undefined && singleText.includes('??') === true,
              JSON.stringify(singleText?.slice(0, 160)))
          } else {
            check('fallback engine runs single-pass pdflatex',
              repeatedBody.engine === 'pdflatex', String(repeatedBody.engine))
          }
        }
      }
    } finally {
      rmSync(referenceFile, { force: true })
    }
  }

  section('pdf route')
  const pdfResponse = await pdf.resource(new Request(pdfUrl({
    session: 'smoke-session', path: 'demo/example.tex',
  })))
  const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer())
  check('HTTP 200', pdfResponse.status === 200, String(pdfResponse.status))
  check('content-type pdf', pdfResponse.headers.get('content-type')?.includes('application/pdf') === true,
    String(pdfResponse.headers.get('content-type')))
  check('PDF magic', pdfBytes.subarray(0, 5).toString('latin1') === '%PDF-')
  check('PDF has size', pdfBytes.length > 1000, `${pdfBytes.length} bytes`)
  console.log(`      ${pdfBytes.length} bytes, ${Date.now() - started} ms total`)

  section('workspace listing')
  const listed = await files.resource(new Request(
    `${ORIGIN}/api/prism-latex/files?session=smoke-session`))
  const listedBody = await listed.json()
  check('HTTP 200', listed.status === 200, String(listed.status))
  check('ok: true', listedBody.ok === true, listedBody.error?.code)
  check('demo document listed', Array.isArray(listedBody.files)
    && listedBody.files.includes('demo/example.tex'), JSON.stringify(listedBody.files))
  check('workspace root reported', typeof listedBody.root === 'string' && listedBody.root.length > 0)
  check('only LaTeX suffixes', (listedBody.files ?? []).every(file => /\.(tex|latex|ltx)$/i.test(file)),
    JSON.stringify(listedBody.files))
  check('sorted', JSON.stringify(listedBody.files) === JSON.stringify([...(listedBody.files ?? [])].sort(
    (left, right) => left.localeCompare(right, 'en', { numeric: true }))))

  section('source route')
  const sourceResponse = await source.resource(new Request(
    `${ORIGIN}/api/prism-latex/source?session=smoke-session&path=demo/example.tex`))
  const sourceBody = await sourceResponse.json()
  check('HTTP 200', sourceResponse.status === 200, String(sourceResponse.status))
  check('ok: true', sourceBody.ok === true, sourceBody.error?.code)
  check('documentclass present', typeof sourceBody.text === 'string'
    && sourceBody.text.includes(String.fromCharCode(92) + 'documentclass'), String(sourceBody.text).slice(0, 60))
  check('not truncated', sourceBody.truncated === false, String(sourceBody.truncated))
  check('version reported', typeof sourceBody.version === 'string' && sourceBody.version.length > 0)

  section('write route')
  const postWrite = payload => new Promise(resolve => {
    const req = new EventEmitter()
    req.method = 'POST'
    req.headers = { host: '127.0.0.1:1', 'content-type': 'application/json' }
    req.url = '/api/prism-latex/write'
    const res = {
      writeHead(status) { this.status = status },
      end(body) { resolve({ status: this.status, body: JSON.parse(body) }) },
    }
    write.handler(req, res)
    req.emit('data', Buffer.from(JSON.stringify(payload), 'utf8'))
    req.emit('end')
  })

  const originalText = readFileSync(join(root, 'demo/example.tex'), 'utf8')
  const firstRead = await source.resource(new Request(
    `${ORIGIN}/api/prism-latex/source?session=smoke-session&path=demo/example.tex`))
  const firstVersion = (await firstRead.json()).version
  try {
    const saved = await postWrite({
      session: 'smoke-session', path: 'demo/example.tex',
      text: `${originalText}\n% edited by the smoke test\n`, expectedVersion: firstVersion,
    })
    check('save accepted', saved.status === 200 && saved.body.ok === true, JSON.stringify(saved.body))
    check('new version returned', typeof saved.body.version === 'string' && saved.body.version !== firstVersion)
    check('file on disk changed', readFileSync(join(root, 'demo/example.tex'), 'utf8').includes('edited by the smoke test'))

    const conflict = await postWrite({
      session: 'smoke-session', path: 'demo/example.tex', text: '% stale\n', expectedVersion: firstVersion,
    })
    check('stale save refused', conflict.status === 409, String(conflict.status))
    check('conflict code', conflict.body.error?.code === 'source-changed', JSON.stringify(conflict.body.error))
    check('conflict reports current version', typeof conflict.body.error?.currentVersion === 'string')

    const nonTex = await postWrite({ session: 'smoke-session', path: 'README.md', text: 'x' })
    check('non-LaTeX refused', nonTex.status === 400, String(nonTex.status))

    const missingFields = await postWrite({ session: 'smoke-session', path: 'demo/example.tex' })
    check('missing text refused', missingFields.status === 400, String(missingFields.status))
  } finally {
    writeFileSync(join(root, 'demo/example.tex'), originalText)
  }

  section('request guards')
  const badExtension = await render.resource(new Request(renderUrl({
    session: 'smoke-session', path: 'README.md',
  })))
  const badExtensionBody = await badExtension.json()
  check('non-tex rejected 400', badExtension.status === 400, String(badExtension.status))
  check('non-tex error code', badExtensionBody.error?.code === 'bad-request',
    JSON.stringify(badExtensionBody.error))

  const escape = await render.resource(new Request(renderUrl({
    session: 'smoke-session', path: '../../../etc/passwd.tex',
  })))
  const escapeBody = await escape.json()
  check('path escape rejected 403', escape.status === 403, String(escape.status))
  check('escape error code', escapeBody.error?.code === 'forbidden', JSON.stringify(escapeBody.error))

  const crossSite = await render.resource(new Request(renderUrl({
    session: 'smoke-session', path: 'demo/example.tex',
  }), { headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' } }))
  check('cross-site origin rejected 403', crossSite.status === 403, String(crossSite.status))

  const missing = await render.resource(new Request(renderUrl({
    session: 'smoke-session', path: 'demo/does-not-exist.tex',
  })))
  check('missing file 404', missing.status === 404, String(missing.status))

  const noSession = await render.resource(new Request(renderUrl({ path: 'demo/example.tex' })))
  check('missing session 400', noSession.status === 400, String(noSession.status))

  section('compiler failure reporting')
  const scratch = mkdtempSync(join(tmpdir(), 'dsh-prismlx-smoke-'))
  try {
    const broken = join(root, 'demo', `.smoke-broken-${process.pid}.tex`)
    writeFileSync(broken, '\\documentclass{article}\n\\begin{document}\n\\undefinedcommand\n\\end{document}\n')
    const brokenResponse = await render.resource(new Request(renderUrl({
      session: 'smoke-session', path: `demo/${broken.split('/').pop()}`,
    })))
    const brokenBody = await brokenResponse.json()
    rmSync(broken, { force: true })
    check('compile failure is HTTP 200', brokenResponse.status === 200, String(brokenResponse.status))
    check('ok: false', brokenBody.ok === false, JSON.stringify(brokenBody).slice(0, 300))
    check('error code', brokenBody.error?.code === 'latex-error', JSON.stringify(brokenBody.error?.code))
    check('log tail survives', typeof brokenBody.error?.logTail === 'string'
      && brokenBody.error.logTail.length > 0)
    check('log mentions the command', /undefinedcommand|Undefined control sequence/i
      .test(brokenBody.error?.logTail ?? ''))
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }

  section(failures === 0 ? 'PASS — all checks green' : `FAIL — ${failures} check(s) failed`)
  process.exitCode = failures === 0 ? 0 : 1
}

await main()
