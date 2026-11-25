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
writeFileSync(modulePath,
  `${block}\nexport { matchDelimiterAt, bracketDecorations, matchEnvironmentAt, rangeDecorations,
    findMatches, completionAt, filterCompletions, collectLabels }\n`)
// Address helpers live outside the tokenizer block; lift them separately.
const addressStart = source.indexOf('    const SESSION_RESOURCE_PREFIX')
const addressEnd = source.indexOf('    function base64ToBytes', addressStart)
const addressModulePath = join(directory, 'addresses.mjs')
writeFileSync(addressModulePath,
  `${source.slice(addressStart, addressEnd)}\nexport { parseFileAddress, isLatexAddress, lineStartOffset, lineNumberAt, collectSections }\n`)
const { parseFileAddress, isLatexAddress, lineStartOffset, lineNumberAt, collectSections } =
  await import(pathToFileURL(addressModulePath).href)

// The cross-surface channels are module state too; lift them to test replay and cleanup.
const jumpStart = source.indexOf('    let lastJump\n')
const jumpEnd = source.indexOf('    function interpolate', jumpStart)
if (jumpStart < 0 || jumpEnd < 0) {
  console.error('FAIL — the channel block moved; update this script')
  process.exit(1)
}
const jumpModulePath = join(directory, 'jumps.mjs')
writeFileSync(jumpModulePath,
  `${source.slice(jumpStart, jumpEnd)}\nexport { publishJump, subscribeJump, publishDocument, subscribeDocument }\n`)
const { publishJump, subscribeJump, publishDocument, subscribeDocument } =
  await import(pathToFileURL(jumpModulePath).href)

const { matchDelimiterAt, bracketDecorations, matchEnvironmentAt, rangeDecorations, findMatches,
  completionAt, filterCompletions, collectLabels } = await import(pathToFileURL(modulePath).href)

let failures = 0
function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ok  ${label}`)
    return
  }
  failures += 1
  console.log(`FAIL  ${label}${detail === '' ? '' : ` — ${detail}`}`)
}

/** The balanced source text of one `const name = (...) => { ... }` block. */
function functionBlock(marker, from = 0) {
  const start = source.indexOf(marker, from)
  if (start < 0) return undefined
  const arrow = source.indexOf('=>', start)
  const open = arrow < 0 ? -1 : source.indexOf('{', arrow)
  if (open < 0) return undefined
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    else if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  return undefined
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

section('environment pairing')
{
  const doc = '\\begin{itemize}\n  \\item x\n\\end{itemize}'
  const open = matchEnvironmentAt(doc, 3)
  check('begin pairs with its end', open?.env === 'itemize'
    && open?.begin.at === 7 && open?.end.at === 31, JSON.stringify(open))
  const back = matchEnvironmentAt(doc, 31)
  check('end pairs back to its begin', back?.begin.at === 7 && back?.end.at === 31,
    JSON.stringify(back))

  const nested = '\\begin{a}\\begin{a}\\end{a}\\end{a}'
  const inner = matchEnvironmentAt(nested, 2)
  check('nested begin pairs with the outer end', inner?.begin.at === 7 && inner?.end.at === 30,
    JSON.stringify(inner))
  const second = matchEnvironmentAt(nested, 11)
  check('inner begin pairs with the inner end', second?.begin.at === 16 && second?.end.at === 23,
    JSON.stringify(second))

  const mixed = '\\begin{a}\\begin{b}\\end{b}\\end{a}'
  check('other environments are skipped', matchEnvironmentAt(mixed, 2)?.end.at === 30,
    JSON.stringify(matchEnvironmentAt(mixed, 2)))
  check('outside an environment no pair', matchEnvironmentAt('plain text', 3) === undefined)
}

section('environment decorations')
{
  const doc = '\\begin{a}x\\end{a}'
  const match = matchEnvironmentAt(doc, 3)
  const decorations = rangeDecorations(doc, [match.begin, match.end], 'env')
  check('names are marked on one line', (decorations.get(0) ?? []).length === 2,
    JSON.stringify([...decorations]))
  check('name range keeps its length', decorations.get(0)?.[0]?.length === 1)
}

section('find matches')
{
  const text = 'alpha Beta alpha ALPHA'
  const matches = findMatches(text, 'alpha')
  check('case-insensitive matches', matches.length === 3, JSON.stringify(matches))
  check('offsets reported', matches[0].at === 0 && matches[1].at === 11 && matches[2].at === 17,
    JSON.stringify(matches))
  check('length follows the query', matches.every(match => match.length === 5))
  check('empty query matches nothing', findMatches(text, '').length === 0)
  check('missing query matches nothing', findMatches(text, 'zzz').length === 0)
  const unicode = findMatches('Ünïcode', 'ü')
  check('unicode is matched case-insensitively', unicode.length === 1, JSON.stringify(unicode))
}

section('completion')
{
  const command = completionAt('\\sec', 4)
  check('command prefix completes', command?.kind === 'command' && command.items.includes('section'),
    JSON.stringify(command))
  check('replacement starts after the backslash', command?.start === 1, String(command?.start))
  check('a lone backslash offers nothing', completionAt('\\', 1) === undefined)
  check('unknown prefix offers nothing', completionAt('\\zzz', 4) === undefined)

  const environment = completionAt('\\begin{it', 9)
  check('environment prefix completes', environment?.kind === 'environment'
    && environment.items[0] === 'itemize' && environment.start === 7, JSON.stringify(environment))

  const doc = 'see \\label{fig:one} and \\ref{fi'
  const labels = collectLabels(doc)
  check('labels collected', labels[0] === 'fig:one', JSON.stringify(labels))
  const reference = completionAt(doc, doc.length, labels)
  check('reference completes from labels', reference?.kind === 'label' && reference.items[0] === 'fig:one',
    JSON.stringify(reference))

  const filtered = filterCompletions(['textsc', 'textbf', 'text', 'other'], 'text')
  check('prefix matches rank first', filtered[0] === 'text' || filtered[0] === 'textsc',
    JSON.stringify(filtered))
  check('candidates are capped', filterCompletions(Array.from({ length: 40 }, (_, index) => `c${index}`), '').length === 8)
}

section('scroll coalescing')
{
  const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
  check('scroll work is framed, not per event', source.includes('requestAnimationFrame(() => {')
    && source.includes('scrollFrame.current'))
  check('the textarea uses the coalesced handler', source.includes('onScroll,'))
  check('line height is cached', source.includes('rowRef.current > 0')
    && !source.includes('const parsed = Number.parseFloat(getComputedStyle(area).lineHeight)\n          return'))
  check('parses are memoised', source.includes("useMemo(() => collectSections(text), [text])")
    && source.includes("useMemo(() => highlightLatexLines(text), [text])"))
}

section('document outline')
{
  const doc = [
    '\\documentclass{article}',
    '\\begin{document}',
    '\\section{Alpha}',
    'text',
    '\\subsection{Beta $x^2$}',
    '\\section*{Gamma}',
  ].join('\n')
  const sections = collectSections(doc)
  check('every sectioning command is found', sections.length === 3, JSON.stringify(sections))
  check('lines are 1-based', sections[0].line === 3 && sections[1].line === 5)
  check('levels follow the command', sections[0].level === 3 && sections[1].level === 4)
  check('titles are plain text', sections[0].title === 'Alpha' && sections[1].title === 'Beta $x^2$',
    JSON.stringify(sections.map(entry => entry.title)))
  check('starred sections count', sections[2].title === 'Gamma')
  check('empty documents have no outline', collectSections('').length === 0)
}

section('column mapping')
{
  const host = readFileSync(new URL('../src/host.js', import.meta.url), 'utf8')
  const start = host.indexOf('const TYPESET_COMMANDS')
  const endMarker = '\n}\n'
  const end = host.indexOf(endMarker, host.indexOf('function columnFromFraction(')) + endMarker.length
  const modulePath = join(directory, 'column.mjs')
  writeFileSync(modulePath, `${host.slice(start, end)}\nexport { columnFromFraction, typesetUnits }\n`)
  const { columnFromFraction, typesetUnits } = await import(pathToFileURL(modulePath).href)
  const width = line => typesetUnits(line).reduce((total, unit) => total + unit.weight, 0)

  // Commands that print text of their own must count; wrappers must not.
  check('\\LaTeX prints five characters', width('\\LaTeX{}') === 5, String(width('\\LaTeX{}')))
  check('\\texttt{.tex} prints four', width('\\texttt{.tex}') === 4, String(width('\\texttt{.tex')))
  check('\\emph{Fit} prints three', width('\\emph{Fit}') === 3, String(width('\\emph{Fit}')))
  check('inline math prints its own text', width('$e^{i\\pi} + 1 = 0$') === 11,
    String(width('$e^{i\\pi} + 1 = 0$')))
  check('a sectioning command prints is zero', width('\\section{Intro}') === 5,
    String(width('\\section{Intro}')))

  const sample = 'Open-Prism integrates \\LaTeX{} directly'
  const tex = sample.indexOf('\\LaTeX')
  // `\\LaTeX` owns roughly 22/35 .. 27/35 of the printed width, so a click there belongs to it.
  check('a click on \\LaTeX lands on its backslash',
    columnFromFraction(sample, 0.65) === tex, String(columnFromFraction(sample, 0.65)))
  check('a click after \\LaTeX stays after it',
    columnFromFraction(sample, 0.85) > tex + 6, String(columnFromFraction(sample, 0.85)))

  check('out-of-range fractions clamp', columnFromFraction('abc', -3) === 0
    && columnFromFraction('abc', 9) === 2)
}

section('line offsets')
{
  const doc = 'a\nbb\nccc'
  check('line 1 starts at 0', lineStartOffset(doc, 1) === 0)
  check('line 2 starts after the first newline', lineStartOffset(doc, 2) === 2)
  check('line 3 starts after the second newline', lineStartOffset(doc, 3) === 5)
  check('past the end clamps to the last line', lineStartOffset(doc, 99) === 5)
  check('junk clamps to the first line', lineStartOffset(doc, 'x') === 0)
  check('line numbers round-trip', [1, 2, 3].every(line =>
    lineNumberAt(doc, lineStartOffset(doc, line)) === line))
}

section('file addresses')
{
  const session = parseFileAddress('dsh-resource://file/session/sess-1/demo/example.tex')
  check('session address parsed', session?.sessionId === 'sess-1' && session?.path === 'demo/example.tex',
    JSON.stringify(session))
  const absolute = parseFileAddress('dsh-resource://file/absolute/Volumes/SSD/demo/a%20b.tex')
  check('absolute address parsed', absolute?.absolute === true
    && absolute?.path === 'Volumes/SSD/demo/a b.tex', JSON.stringify(absolute))
  check('absolute address has no session', absolute?.sessionId === undefined)
  check('other schemes are refused', parseFileAddress('dsh-resource://plan/x.tex') === undefined)
  check('junk is refused without throwing', parseFileAddress(undefined) === undefined
    && parseFileAddress('') === undefined)
  check('suffix check accepts LaTeX files', isLatexAddress('dsh-resource://file/absolute/tmp/x.latex') === true)
  check('suffix check rejects other files', isLatexAddress('dsh-resource://file/session/s/x.md') === false)
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

section('jump channel')
{
  const seen = []
  const first = subscribeJump(jump => seen.push(jump))
  publishJump({ line: 4, column: 2, path: 'demo/a.tex', sessionId: 's1' })
  check('published jump reaches a subscriber', seen.length === 1
    && seen[0].line === 4 && seen[0].column === 2 && seen[0].path === 'demo/a.tex',
    JSON.stringify(seen))
  check('jump carries the session and a timestamp', seen[0].sessionId === 's1'
    && Number.isFinite(seen[0].at))
  first()
  publishJump({ line: 9, path: 'demo/a.tex', sessionId: 's1' })
  check('unsubscribe stops delivery', seen.length === 1, String(seen.length))
  const late = []
  const off = subscribeJump(jump => late.push(jump))
  check('a late subscriber replays the latest jump', late.length === 1 && late[0].line === 9,
    JSON.stringify(late))
  off()
  publishJump({ line: Number.NaN, path: 'demo/a.tex' })
  publishJump({ line: 3 })
  publishJump(null)
  const strict = []
  const stop = subscribeJump(jump => strict.push(jump))
  publishJump({ line: 11, path: 'demo/a.tex' })
  stop()
  check('malformed jumps are refused', strict.length === 2 && strict[1].line === 11,
    JSON.stringify(strict.map(jump => jump.line)))
  check('a jump without a column starts at zero', strict[1]?.column === 0,
    JSON.stringify(strict[1]))
}

section('current document channel')
{
  const seen = []
  const first = subscribeDocument(document => seen.push(document))
  publishDocument({ path: 'demo/a.tex', sessionId: 's1' })
  check('published document reaches a subscriber', seen.length === 1
    && seen[0].path === 'demo/a.tex' && seen[0].sessionId === 's1',
  JSON.stringify(seen))
  check('document carries a timestamp', Number.isFinite(seen[0].at))
  first()
  publishDocument({ path: 'demo/b.tex', sessionId: 's1' })
  check('unsubscribe stops document delivery', seen.length === 1, String(seen.length))
  const late = []
  const off = subscribeDocument(document => late.push(document))
  check('a late subscriber replays the latest document', late.length === 1
    && late[0].path === 'demo/b.tex', JSON.stringify(late))
  off()
  publishDocument({ path: '' })
  publishDocument({ path: 42 })
  publishDocument(null)
  const strict = []
  const stop = subscribeDocument(document => strict.push(document))
  publishDocument({ path: 'demo/c.tex' })
  stop()
  check('malformed documents are refused', strict.length === 2
    && strict[1].path === 'demo/c.tex' && strict[1].sessionId === undefined,
  JSON.stringify(strict))
}

section('document channel wiring')
{
  check('the sidebar tab publishes its document',
    source.includes('publishDocument({ path: target.path, sessionId })'))
  check('the conversation view subscribes to the document channel',
    source.includes('useEffect(() => subscribeDocument(document =>'))
}

section('outline-only conversation view')
{
  check('the .tex file list markup is gone',
    !source.includes('oprilx-panel-list') && !source.includes('oprilx-panel-row')
    && !source.includes('oprilx-files'))
  check('the view renders the Outline column',
    source.includes("className: 'oprilx-outline'")
    && source.includes("className: 'oprilx-outline-title'"))
  check('the Outline column has an accessible splitter',
    source.includes("'aria-label': tr(t, 'resizeOutline')")
    && source.includes("'aria-valuemin': OUTLINE_WIDTH_MIN"))
  check('the Outline width and visibility are persisted',
    source.includes('function readOutlineWidth') && source.includes('function rememberOutlineOpen'))
  check('the view no longer lists workspace files',
    !source.includes('searchTex') && !source.includes('panelFileCount'))
}

section('view preview toggle')
{
  check('the view has an eye toggle for its preview',
    source.includes("preview ? 'viewPreviewHide' : 'viewPreviewShow'"))
  check('the preview column is optional',
    source.includes("'data-preview': preview ? 'true' : 'false'")
    && source.includes("className: 'oprilx-panel-doc'"))
  check('the preview is hidden by default',
    source.includes('function readViewPreview') && source.includes("return raw === 'open'"))
  check('the preview choice is persisted',
    source.includes('function rememberViewPreview')
    && source.includes("dsh-openprism-latex.view-preview"))
  check('a hidden preview skips the compile',
    source.includes('if (preview !== true || sessionId === undefined || selected === undefined)'))
  check('the editor widens when the preview is hidden',
    source.includes('.oprilx-workspace[data-preview="false"] .oprilx-editor-pane'))
}

section('inverse search only publishes')
{
  const marker = '      const inverseSearchAt = (index, event) => {'
  const tabStart = source.indexOf(marker)
  const panelStart = source.indexOf(marker, tabStart + 1)
  const tabInverse = functionBlock(marker)
  const panelInverse = functionBlock(marker, tabStart + 1)
  check('the tab body has an inverse search', tabInverse !== undefined)
  check('the conversation view has an inverse search', panelInverse !== undefined
    && panelStart > tabStart)
  for (const [name, block] of [['tab', tabInverse], ['panel', panelInverse]]) {
    check(`${name} inverse search publishes the jump`, block?.includes('publishJump(') === true)
    check(`${name} inverse search never switches the mode`, block?.includes('setMode(') === false)
    check(`${name} inverse search never retargets its own pane`,
      block?.includes('jumpToSourceLine(') === false)
  }
  check('the document preview publishes too', source.includes('onPageDoubleClick: previewInverseSearchAt'))
  check('the conversation view subscribes to the channel',
    source.includes('useEffect(() => subscribeJump('))
}

function section(title) {
  console.log(`\n${title}`)
}

if (failures > 0) {
  console.error(`\nFAIL — ${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nPASS — all checks green')
