#!/usr/bin/env node
/**
 * Verify the *installed* plugin against the running DSH host.
 *
 * The Host half's routes are loopback-only and bypass the app's session cookie, so the
 * compile pipeline can be exercised for real from this script once DSH has restarted with
 * the bundle installed. The Client half is verified separately in the app's Slots inspector.
 *
 * Usage: node scripts/verify-live.mjs [--write-pages <dir>]
 *   DSH_WEB_URL      origin of the running app (set by DSH in a shell)
 *   DSH_SESSION_ID   a live session whose workspace contains demo/example.tex
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const origin = process.env.DSH_WEB_URL ?? 'http://127.0.0.1:61896'
const session = process.env.DSH_SESSION_ID
const pageArg = process.argv.indexOf('--write-pages')
const pageOutput = pageArg === -1 ? undefined : resolve(process.argv[pageArg + 1])

let failures = 0
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok  ${label}`)
    return
  }
  failures += 1
  console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
}

const renderUrl = new URL('/api/prism-latex/render', origin)
renderUrl.searchParams.set('session', session ?? '')
renderUrl.searchParams.set('path', 'demo/example.tex')

console.log(`\nhost: ${origin}`)
console.log(`session: ${session ?? '(missing DSH_SESSION_ID)'}`)
if (session === undefined) {
  console.log('FAIL — DSH_SESSION_ID is not set; run this from a DSH shell call')
  process.exit(1)
}

console.log('\nrender route')
const started = Date.now()
const response = await fetch(renderUrl, { headers: { accept: 'application/json' } })
const text = await response.text()
let body
try {
  body = JSON.parse(text)
} catch {
  body = undefined
}
check('HTTP 200', response.status === 200, `${response.status} ${text.slice(0, 200)}`)
check('JSON body', body !== undefined, text.slice(0, 200))
if (body?.ok === true) {
  check('pages returned', body.pages.length > 0, String(body.pages.length))
  check('pageCount', body.pageCount === body.pages.length, `${body.pageCount}/${body.pages.length}`)
  for (const [index, page] of body.pages.entries()) {
    const bytes = Buffer.from(page.png, 'base64')
    check(`page ${index + 1} is a PNG`, bytes.subarray(1, 4).toString('latin1') === 'PNG',
      bytes.subarray(0, 8).toString('hex'))
  }
  console.log(`      ${body.pages.length} page(s) via ${body.engine} in ${body.durationMs} ms`
    + ` (request ${Date.now() - started} ms)`)
  if (pageOutput !== undefined) {
    mkdirSync(pageOutput, { recursive: true })
    for (const [index, page] of body.pages.entries()) {
      const file = join(pageOutput, `live-page-${String(index + 1).padStart(3, '0')}.png`)
      writeFileSync(file, Buffer.from(page.png, 'base64'))
      console.log(`      wrote ${file}`)
    }
  }
} else {
  console.log('      error:', JSON.stringify(body?.error ?? text.slice(0, 400)))
}

console.log('\npdf route')
const pdfUrl = new URL('/api/prism-latex/pdf', origin)
pdfUrl.searchParams.set('session', session)
pdfUrl.searchParams.set('path', 'demo/example.tex')
const pdfResponse = await fetch(pdfUrl)
const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer())
check('HTTP 200', pdfResponse.status === 200, String(pdfResponse.status))
check('content type', pdfResponse.headers.get('content-type')?.includes('application/pdf') === true,
  String(pdfResponse.headers.get('content-type')))
check('PDF magic', pdfBytes.subarray(0, 5).toString('latin1') === '%PDF-')
console.log(`      ${pdfBytes.length} bytes`)

console.log('\nguards stay closed')
const escape = new URL('/api/prism-latex/render', origin)
escape.searchParams.set('session', session)
escape.searchParams.set('path', '../../../etc/hosts.tex')
const escapeResponse = await fetch(escape)
check('path escape refused', escapeResponse.status === 403, String(escapeResponse.status))

const crossSite = await fetch(renderUrl, { headers: { origin: 'https://evil.example' } })
check('cross-site origin refused', crossSite.status === 403, String(crossSite.status))

console.log(failures === 0 ? '\nPASS — the installed Host half compiles live' : `\nFAIL — ${failures} check(s)`)
process.exitCode = failures === 0 ? 0 : 1
