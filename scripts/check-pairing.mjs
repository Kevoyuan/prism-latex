/**
 * Unit checks for the delimiter pairing helpers.
 *
 * They live inside the client bundle (no module boundary), so this script lifts the
 * pure block out of the source and exercises it in isolation. Run with `node
 * scripts/check-pairing.mjs`; exits non-zero on the first failure.
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
const start = source.indexOf('    const BRACKET_PAIRS')
const end = source.indexOf('    /** Render one highlighted run list')
if (start < 0 || end < 0) {
  console.error('FAIL — the delimiter helper block moved; update this script')
  process.exit(1)
}
const block = source.slice(start, end)
const directory = mkdtempSync(join(tmpdir(), 'oprilx-pairing-'))
const modulePath = join(directory, 'pairing.mjs')
writeFileSync(modulePath, `${block}\nexport { matchDelimiterAt, bracketDecorations }\n`)
const { matchDelimiterAt, bracketDecorations } = await import(pathToFileURL(modulePath).href)

let failures = 0
function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ok  ${label}`)
    return
  }
  failures += 1
  console.log(`FAIL  ${label}${detail === '' ? '' : ` — ${detail}`}`)
}

section('brace pairing')
{
  const text = '\\section{Notes}\nplain'
  const match = matchDelimiterAt(text, 9) // just after `\section{`
  check('opening brace finds its closer', match?.open === 8 && match?.close === 14,
    JSON.stringify(match))
  const reverse = matchDelimiterAt(text, 15) // on the closing brace
  check('closing brace finds its opener', reverse?.open === 8 && reverse?.close === 14,
    JSON.stringify(reverse))
}

section('nesting and escaping')
{
  const nested = '{\\textbf{a {b} c}}'
  const match = matchDelimiterAt(nested, 1)
  check('nested pair skips inner pairs', match?.open === 0 && match?.close === 17,
    JSON.stringify(match))
  const escaped = '\\{not a pair}'
  check('escaped brace is ignored', matchDelimiterAt(escaped, 2) === undefined,
    JSON.stringify(matchDelimiterAt(escaped, 2)))
  const comment = '% { ignored }\n{x}'
  check('commented brace is ignored', matchDelimiterAt(comment, 3) === undefined)
}

section('brackets and parentheses')
{
  const options = '\\usepackage[a4paper]{geometry}'
  const match = matchDelimiterAt(options, 12)
  check('square brackets pair', match?.open === 11 && match?.close === 19, JSON.stringify(match))
  const parens = 'f(x)'
  check('parentheses pair', matchDelimiterAt(parens, 2)?.close === 3)
}

section('unmatched delimiters')
{
  const broken = '\\begin{center'
  const match = matchDelimiterAt(broken, 7)
  check('missing closer reports -1', match?.open === 6 && match?.close === -1, JSON.stringify(match))
  const decorations = bracketDecorations(broken, match)
  const items = [...decorations.values()].flat()
  check('unmatched pair is marked broken', items.every(item => item.kind === 'broken'),
    JSON.stringify(items))
}

section('line decorations')
{
  const text = '{\na\n}'
  const match = matchDelimiterAt(text, 1)
  const decorations = bracketDecorations(text, match)
  check('opener on the first line', decorations.get(0)?.[0]?.at === 0,
    JSON.stringify([...decorations]))
  check('closer on the last line', decorations.get(2)?.[0]?.at === 0,
    JSON.stringify([...decorations]))
  check('untouched line has no decorations', decorations.get(1) === undefined)
}

function section(title) {
  console.log(`\n${title}`)
}

if (failures > 0) {
  console.error(`\nFAIL — ${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nPASS — all checks green')
