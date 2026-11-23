#!/usr/bin/env node
/**
 * Smoke test for the Client half of dsh-openprism-latex.
 *
 * Runs `src/client.js` the way the DSH web loader does — as a classic script in a
 * browser-like global, calling `window.__ModuleLoader__.load` — then wires a stand-in
 * client context and calls the registered document body directly with controlled React
 * hooks. That proves the plugin records the right document-preview definition and slot
 * body, and that each UI state (compiling, error, ready, non-renderer) builds a sane
 * element tree instead of throwing. No browser, DOM, or network.
 *
 * Usage: node scripts/smoke-client.mjs
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { createContext, runInContext } from 'node:vm'

const root = resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)
/** React is not a dependency of the plugin; a dev box finds it in the DSH profile. */
function loadReact() {
  const candidates = [process.env.OPRILX_REACT_PATH, 'react',
    process.env.DSH_PROFILE_DIR === undefined ? undefined : join(process.env.DSH_PROFILE_DIR, 'node_modules', 'react')]
  for (const candidate of candidates) {
    if (candidate === undefined) continue
    try {
      return require(candidate)
    } catch {
      /* try the next one */
    }
  }
  throw new Error('React was not found; set OPRILX_REACT_PATH to a React installation')
}
const React = loadReact()
const source = readFileSync(join(root, 'src', 'client.js'), 'utf8')

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

/** React with test-controlled hooks; `state` seeds the body state, `zoom` the zoom state. */
function makeReact(state, zoom = 'fit', paneWidth, download) {
  let stateCalls = 0
  return {
    ...React,
    useState(initial) {
      stateCalls += 1
      const resolve = value => (typeof value === 'function' ? value() : value)
      if (stateCalls === 1 && state !== undefined) return [state, () => {}]
      if (stateCalls === 2) return [zoom, () => {}]
      if (stateCalls === 3 && download !== undefined) return [download, () => {}]
      if (stateCalls === 4 && paneWidth !== undefined) return [paneWidth, () => {}]
      return [resolve(initial), () => {}]
    },
    useEffect() {},
    useMemo(factory) {
      return factory()
    },
    useRef(value) {
      return { current: value }
    },
  }
}

/** React stub matching the tab body's hook order: mode, state, source, attempt, zoom, download, width. */
function makeTabReact(options = {}) {
  const values = {
    mode: options.mode ?? 'preview',
    state: options.state ?? { status: 'compiling' },
    source: options.source ?? { status: 'idle' },
    attempt: 0,
    zoom: options.zoom ?? 'fit',
    download: options.download ?? { status: 'idle' },
    paneWidth: options.paneWidth ?? 400,
    draft: options.draft,
    save: options.save ?? { status: 'idle' },
  }
  const order = ['mode', 'state', 'source', 'attempt', 'zoom', 'download', 'paneWidth', 'draft', 'save']
  let calls = 0
  return {
    ...React,
    useState(initial) {
      const key = order[calls]
      calls += 1
      if (key !== undefined) return [values[key], () => {}]
      return [typeof initial === 'function' ? initial() : initial, () => {}]
    },
    useEffect() {},
    useMemo(factory) {
      return factory()
    },
    useRef(value) {
      return { current: value }
    },
  }
}

/** Load a fresh copy of the bundle and apply it to a stand-in client context. */
function mount(react, globals = {}) {
  let registration
  const sandbox = {
    console,
    // The browser globals the bundle may read; a test can supply its own before mounting.
    localStorage: globalThis.localStorage,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    btoa: value => Buffer.from(String(value), 'binary').toString('base64'),
    fetch: () => Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) }),
    URL,
    URLSearchParams,
    AbortController,
    Blob,
    ...globals,
  }
  // Browser-like realm: `window` IS the global, so Prism's `new Function` code and its
  // `window.Prism` assignment behave as they do in the page.
  sandbox.__ModuleLoader__ = { load(value) { registration = value } }
  sandbox.window = sandbox
  sandbox.self = sandbox
  runInContext(source, createContext(sandbox), { filename: 'client.js' })
  if (registration === undefined) throw new Error('bundle registered nothing')

  const dictionaries = { en: new Map(), zh: new Map() }
  const recorded = {
    definition: undefined, slot: undefined, slots: [], namespace: undefined, tabType: undefined,
  }
  const context = {
    effect(fn) {
      return fn()
    },
    inject(_deps, callback) {
      return callback(this)
    },
    locale: {
      register(namespace, provided) {
        recorded.namespace = namespace
        for (const [key, value] of Object.entries(provided.en ?? {})) dictionaries.en.set(key, value)
        for (const [key, value] of Object.entries(provided.zh ?? {})) dictionaries.zh.set(key, value)
        return () => {}
      },
      bind() {
        return (key, values) => {
          const template = dictionaries.en.get(key) ?? key
          if (values === undefined) return template
          return String(template).replace(/\{(\w+)\}/g, (match, name) => (
            values[name] === undefined ? match : String(values[name])))
        }
      },
    },
    sidebarRightTabs: {
      register(definition) {
        recorded.tabType = definition
        return () => {}
      },
    },
    documentPreviews: {
      register(definition) {
        recorded.definition = definition
        return () => {}
      },
    },
    slots: {
      inject(_owner, callback) {
        return callback()
      },
      register(options, body) {
        recorded.slot = { options, body }
        recorded.slots.push({ options, body })
        return () => {}
      },
    },
  }
  const plugin = registration.factory(specifier => {
    if (specifier === 'react') return react
    throw new Error(`unexpected require(${specifier})`)
  })
  plugin.apply(context)
  const findSlot = name => recorded.slots.find(entry => entry.options?.name === name)
  return {
    registration,
    plugin,
    ...recorded,
    ...dictionaries,
    // `slot` stays the document body so the body sections read naturally; the panel
    // registrations stay reachable by name.
    slot: findSlot('sidebar.right.tab.document'),
    documentSlot: findSlot('sidebar.right.tab.document'),
    panelSlot: findSlot('main'),
    iconSlot: findSlot('sidebar.panellist'),
  }
}

/** Flatten an element tree into inspectable nodes, rendering nested components. */
function flatten(node, out = [], depth = 0) {
  if (node === null || node === undefined || node === false || node === true) return out
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, out, depth)
    return out
  }
  if (typeof node === 'object' && node.props !== undefined) {
    // Function components (SourceEditor and friends) are invoked so their output is
    // inspectable; the hook stubs make a plain call safe.
    if (typeof node.type === 'function' && depth < 8) {
      flatten(node.type(node.props), out, depth + 1)
      return out
    }
    out.push(node)
    flatten(node.props.children, out, depth)
    return out
  }
  out.push({ text: String(node) })
  return out
}

function textOf(tree) {
  return flatten(tree).map(node => (typeof node.text === 'string' ? node.text : '')).join(' ')
}

const ADDRESS = 'dsh-resource://file/session/sess-1/demo/example.tex'

function baseProps(overrides = {}) {
  return {
    content: { kind: 'renderer', revision: 1, loaded() {}, failed() {}, reload() {} },
    resourceAddress: ADDRESS,
    scrollportRef: () => {},
    useTabInfo: () => ({ tab: { id: 'tab-1', signal: new AbortController().signal } }),
    useResource: () => ({ value: { version: '7-42' } }),
    t: key => key,
    sessionId: 'sess-1',
    ...overrides,
  }
}

/* ---------------------------------------------------------------------- */

section('bundle shape')
{
  const bundle = mount(makeReact(undefined))
  check('one registration', bundle.registration !== undefined)
  check('bundle id', bundle.registration.id === 'dsh-openprism-latex', String(bundle.registration.id))
  check('factory is a function', typeof bundle.registration.factory === 'function')
  check('classic script, no ESM import', !/^\s*import\s/m.test(source))
  const required = [...source.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(match => match[1])
  check('only react is required', required.length === 1 && required[0] === 'react', required.join(','))
  check('plugin name', bundle.plugin.name === 'dsh-openprism-latex', String(bundle.plugin.name))
  check('declares slots, locale and the tab registry',
    JSON.stringify(bundle.plugin.inject) === JSON.stringify(['slots', 'locale', 'sidebarRightTabs']),
    JSON.stringify(bundle.plugin.inject))
}

section('document preview definition')
{
  const { definition, slot, namespace, en, zh } = mount(makeReact(undefined))
  check('registered', definition !== undefined)
  check('id matches the slot key', definition?.id === slot?.options?.key, `${definition?.id} / ${slot?.options?.key}`)
  check('suffixes', JSON.stringify(definition?.extensions) === JSON.stringify(['tex', 'latex', 'ltx']),
    JSON.stringify(definition?.extensions))
  check('external band', definition?.priority === 'extension', String(definition?.priority))
  check('renderer owns loading', definition?.loading === 'renderer', String(definition?.loading))
  check('localized title hook', definition?.title() === 'LaTeX document', String(definition?.title?.()))
  check('slot name', slot?.options?.name === 'sidebar.right.tab.document', String(slot?.options?.name))
  check('slot locale namespace', slot?.options?.locale === namespace, String(slot?.options?.locale))
  check('body component', typeof slot?.body === 'function')
  check('English title', en.get('title') === 'LaTeX document', en.get('title'))
  check('English-only copy', zh.size === 0, `${zh.size} Chinese strings leaked`)
  check('mode labels are English', en.get('modePreview') === 'Preview'
    && en.get('modeSource') === 'Source' && en.get('modeSplit') === 'Side by side', '')
  check('no Chinese characters in the copy', [...en.values()].every(value => !/[\u4e00-\u9fff]/u.test(value)),
    [...en.values()].filter(value => /[\u4e00-\u9fff]/u.test(value)).join(' | '))
  check('placeholders kept', en.get('pageMeta').includes('{count}')
    && en.get('statusReady').includes('{pages}'))
}

section('state: compiling')
{
  const { slot, en } = mount(makeReact(undefined))
  const tree = slot.body(baseProps({ t: key => en.get(key) ?? key }))
  const nodes = flatten(tree)
  check('root element', nodes[0]?.type === 'div' && nodes[0].props.className === 'oprilx-root',
    String(nodes[0]?.props?.className))
  check('style element', nodes.some(node => node.type === 'style'
    && String(node.props.children).includes('.oprilx-root')))
  check('status role', nodes.some(node => node.props?.role === 'status'))
  check('spinner', nodes.some(node => node.props?.className === 'oprilx-spinner'))
  check('localized label', textOf(tree).includes('Compiling LaTeX'), textOf(tree).slice(0, 120))
  check('scrollport attached', typeof nodes[0]?.ref === 'function')
}

section('state: not this renderer')
{
  const { slot } = mount(makeReact(undefined))
  const tree = slot.body(baseProps({ content: { kind: 'text', text: 'x', pages: [], eof: true } }))
  check('renders nothing', tree === null, JSON.stringify(tree))
}

section('state: error')
{
  const { slot, en } = mount(makeReact({
    status: 'error',
    error: {
      code: 'latex-error',
      message: 'Undefined control sequence',
      line: 12,
      logTail: '! Undefined control sequence.\nl.12 \\undefinedcommand',
    },
  }))
  const tree = slot.body(baseProps({ t: key => en.get(key) ?? key }))
  const nodes = flatten(tree)
  const text = textOf(tree)
  check('alert role', nodes.some(node => node.props?.role === 'alert'))
  check('error headline', text.includes('This document could not be compiled'))
  check('source line', text.includes('Line 12'), text.slice(0, 200))
  check('compiler message', text.includes('Undefined control sequence'))
  check('log block', nodes.some(node => node.type === 'pre' && node.props.className === 'oprilx-log'))
  check('retry button', nodes.some(node => node.type === 'button'
    && node.props['aria-label'] === 'Retry'))
}

section('state: ready (fit width)')
{
  const { slot, en } = mount(makeReact({
    status: 'ready',
    pages: [
      { url: 'blob:page-1', width: 1191, height: 1684 },
      { url: 'blob:page-2', width: 1191, height: 1684 },
    ],
    pageCount: 2,
    durationMs: 812,
    dpi: 144,
    pdfUrl: 'api/dsh-openprism-latex/pdf?session=sess-1&path=demo/example.tex',
    truncated: false,
  }))
  const tree = slot.body(baseProps({ t: key => en.get(key) ?? key }))
  const nodes = flatten(tree)
  const images = nodes.filter(node => node.type === 'img')
  const buttons = nodes.filter(node => node.type === 'button')
  const text = textOf(tree)
  check('two page images', images.length === 2, String(images.length))
  check('page src', images[0]?.props.src === 'blob:page-1', String(images[0]?.props.src))
  check('intrinsic size kept', images[0]?.props.width === 1191 && images[0]?.props.height === 1684)
  check('lazy images', images.every(image => image.props.loading === 'lazy'))
  check('accessible alt text', images[0]?.props.alt === 'Page 1', String(images[0]?.props.alt))
  const pageWrapper = nodes.find(node => node.props?.className === 'oprilx-page')
  check('page wrapper carries fit width', pageWrapper?.props?.style?.width === '100%'
    && /px$/.test(String(pageWrapper?.props?.style?.maxWidth)), JSON.stringify(pageWrapper?.props?.style))
  check('control group', nodes.some(node => node.props?.role === 'group'
    && node.props['aria-label'] === 'Preview controls'))
  check('fit width pressed', nodes.some(node => node.props?.['aria-pressed'] === 'true'))
  check('meta line', text.includes('2 pages') && text.includes('0.8'), text.slice(0, 200))
  check('download control', buttons.some(button => button.props['aria-label'] === 'Download PDF'
    && flatten(button).some(node => node.type === 'svg')))
  check('zoom labels', buttons.some(button => button.props['aria-label'] === 'Zoom in')
    && buttons.some(button => button.props['aria-label'] === 'Zoom out'))
}

section('state: ready (fixed zoom)')
{
  const { slot, en } = mount(makeReact({
    status: 'ready',
    pages: [{ url: 'blob:page-1', width: 1191, height: 1684 }],
    pageCount: 1,
    durationMs: 300,
    dpi: 144,
    pdfUrl: '',
    truncated: false,
  }, 1.5))
  const tree = slot.body(baseProps({ t: key => en.get(key) ?? key }))
  const nodes = flatten(tree)
  const images = nodes.filter(node => node.type === 'img')
  check('one page image', images.length === 1, String(images.length))
  const pageWrapper = nodes.find(node => node.props?.className === 'oprilx-page')
  check('page wrapper carries scaled px width', /^\d+px$/.test(String(pageWrapper?.props?.style?.width)),
    JSON.stringify(pageWrapper?.props?.style))
  check('zoom percentage shown', textOf(tree).includes('150%'), textOf(tree).slice(0, 160))
}

section('state: truncated preview')
{
  const { slot, en } = mount(makeReact({
    status: 'ready',
    pages: [{ url: 'blob:page-1', width: 1191, height: 1684 }],
    pageCount: 50,
    durationMs: 4200,
    dpi: 144,
    pdfUrl: '',
    truncated: true,
  }))
  const tree = slot.body(baseProps({ t: key => en.get(key) ?? key }))
  check('truncation is stated', textOf(tree).includes('First 50 pages'), textOf(tree).slice(0, 220))
}

section('state: absolute address')
{
  const { slot } = mount(makeReact(undefined))
  const tree = slot.body(baseProps({ resourceAddress: 'dsh-resource://file/absolute/tmp/x.tex' }))
  check('no throw', tree !== null)
  check('pane never goes blank', textOf(tree).length > 0)
}

section('state: refreshing keeps the pages on screen')
{
  const { slot, en } = mount(makeReact({
    status: 'ready',
    refreshing: true,
    pages: [{ url: 'blob:page-1', width: 1191, height: 1684 }],
    pageCount: 1,
    durationMs: 500,
    dpi: 144,
    pdfUrl: 'api/dsh-openprism-latex/pdf?session=sess-1&path=demo/example.tex',
    truncated: false,
  }))
  const tree = slot.body(baseProps({ t: key => en.get(key) ?? key }))
  const images = flatten(tree).filter(node => node.type === 'img')
  const text = textOf(tree)
  check('pages stay visible', images.length === 1, String(images.length))
  check('refresh is announced', text.includes('Recompiling'), text.slice(0, 200))
  check('no full-pane spinner', !flatten(tree).some(node => node.props?.className === 'oprilx-spinner'))
}

section('state: download failure is visible')
{
  const ready = {
    status: 'ready',
    pages: [{ url: 'blob:page-1', width: 1191, height: 1684 }],
    pageCount: 1,
    durationMs: 500,
    dpi: 144,
    pdfUrl: 'api/dsh-openprism-latex/pdf?session=sess-1&path=demo/example.tex',
    truncated: false,
  }
  const { slot, en } = mount(makeReact(ready, 'fit', undefined, { status: 'failed' }))
  const tree = slot.body(baseProps({ t: key => en.get(key) ?? key }))
  const notes = flatten(tree).filter(node => node.props?.['data-tone'] === 'error')
  check('failure is announced', notes.some(node => textOf(node).includes('Download failed')),
    JSON.stringify(notes.map(node => textOf(node))))
  check('status role', notes.some(node => node.props?.role === 'status'))

  const second = mount(makeReact(ready, 'fit', undefined, { status: 'idle' }))
  const clean = second.slot.body(baseProps({ t: key => second.en.get(key) ?? key }))
  const downloadButton = flatten(clean).find(node => node.type === 'button'
    && node.props['aria-label'] === 'Download PDF')
  check('download enabled with a pdf url', downloadButton?.props?.disabled === false,
    String(downloadButton?.props?.disabled))
}

section('state: non-retryable error offers no dead-end retry')
{
  const { slot, en } = mount(makeReact({
    status: 'error',
    error: { code: 'engine-missing', message: 'pdflatex was not found' },
  }))
  const tree = slot.body(baseProps({ t: key => en.get(key) ?? key }))
  const text = textOf(tree)
  check('guidance shown', text.includes('No LaTeX engine was found'), text.slice(0, 160))
  check('no retry for a dead end', !flatten(tree).some(node => node.type === 'button'
    && node.props['aria-label'] === 'Retry'))
  check('the error can still be copied', flatten(tree).some(node => node.type === 'button'
    && node.props['aria-label'] === 'Copy the error'))
}

section('zoom steps follow the fit scale in a narrow pane')
{
  const ready = {
    status: 'ready',
    pages: [{ url: 'blob:page-1', width: 1191, height: 1684 }],
    pageCount: 1,
    durationMs: 500,
    dpi: 144,
    pdfUrl: 'api/dsh-openprism-latex/pdf?session=sess-1&path=demo/example.tex',
    truncated: false,
  }
  const { slot, en } = mount(makeReact(ready, 'fit', 400))
  const tree = slot.body(baseProps({ t: key => en.get(key) ?? key }))
  const buttons = flatten(tree).filter(node => node.type === 'button')
  const zoomOut = buttons.find(node => node.props['aria-label'] === 'Zoom out')
  const zoomIn = buttons.find(node => node.props['aria-label'] === 'Zoom in')
  // 1191 px at 144 dpi is 794 CSS px; in a 400 px pane fit is ~0.47, so no fixed
  // step is smaller than it and stepping out would grow the page.
  check('zoom out disabled at fit', zoomOut?.props?.disabled === true, String(zoomOut?.props?.disabled))
  check('zoom in available', zoomIn?.props?.disabled === false, String(zoomIn?.props?.disabled))
}

section('sidebar panel entry')
{
  const { slots, en } = mount(makeReact(undefined))
  const panelEntry = slots.find(entry => entry.options?.name === 'sidebar.panellist')
  const panelBody = slots.find(entry => entry.options?.name === 'main')
  check('sidebar icon registered', panelEntry !== undefined)
  check('icon id', panelEntry?.options?.id === 'dsh-openprism-latex', String(panelEntry?.options?.id))
  check('icon order', panelEntry?.options?.order === 30, String(panelEntry?.options?.order))
  check('icon label', panelEntry?.options?.label?.() === 'LaTeX', String(panelEntry?.options?.label?.()))
  check('main panel body registered', panelBody !== undefined)
  check('main panel key', panelBody?.options?.key === 'dsh-openprism-latex', String(panelBody?.options?.key))
  check('main panel locale', panelBody?.options?.locale === 'openprismLatex', String(panelBody?.options?.locale))
  check('main panel body is a component', typeof panelBody?.body === 'function')

  const iconTree = panelEntry.body({ size: 18, active: true })
  check('icon draws an svg', iconTree?.type === 'svg', String(iconTree?.type))
  check('icon has prism paths', flatten(iconTree).length >= 3, String(flatten(iconTree).length))

  // The main-panel registration wraps LatexPanel in a closure component, so resolve
  // the element it returns and call that component directly.
  const element = panelBody.body({ t: key => en.get(key) ?? key })
  const body = typeof element?.type === 'function' ? element.type(element.props) : element
  const nodes = flatten(body)
  const text = textOf(body)
  check('panel root', nodes[0]?.props?.className === 'oprilx-panel', String(nodes[0]?.props?.className))
  check('panel title', text.includes('LaTeX'))
  check('refresh control', nodes.some(node => node.type === 'button'
    && node.props['aria-label'] === 'Refresh'))
  check('session guidance without a session', text.includes('Open a conversation'),
    text.slice(0, 160))
}

section('sidebar panel with a session')
{
  globalThis.localStorage = { getItem: () => JSON.stringify({ sessionId: 'sess-1' }) }
  try {
    const { slots, en } = mount(makeReact(undefined))
    const panelBody = slots.find(entry => entry.options?.name === 'main')
    const element = panelBody.body({ t: key => en.get(key) ?? key })
    const body = typeof element?.type === 'function' ? element.type(element.props) : element
    const text = textOf(body)
    check('panel renders with a session', body !== null)
    check('loading state announced', text.includes('Looking for .tex files'), text.slice(0, 160))
    check('refresh stays available', flatten(body).some(node => node.type === 'button'
      && node.props['aria-label'] === 'Refresh'))
  } finally {
    delete globalThis.localStorage
  }
}

section('right sidebar tab type')
{
  const { tabType } = mount(makeReact(undefined))
  check('tab type registered', tabType !== undefined)
  check('id is the package name', tabType?.id === 'dsh-openprism-latex', String(tabType?.id))
  check('own kind', tabType?.kind === 'latex', String(tabType?.kind))
  check('recognizes LaTeX suffixes',
    Array.isArray(tabType?.patterns)
      && tabType.patterns.length === 3
      && tabType.patterns.every(pattern => typeof pattern === 'string' && pattern.startsWith('dsh-resource://file/')),
    JSON.stringify(tabType?.patterns))
  check('extension band wins over the builtin viewer', tabType?.priority === 'extension',
    String(tabType?.priority))
  check('title is the decoded basename',
    tabType?.title('dsh-resource://file/session/s1/demo/example.tex') === 'example.tex',
    String(tabType?.title?.('dsh-resource://file/session/s1/demo/example.tex')))
  check('claims session file addresses', tabType?.canOpen(ADDRESS) === true)
  check('refuses absolute addresses', tabType?.canOpen('dsh-resource://file/absolute/tmp/x.tex') === false)
}

section('right sidebar tab chip')
{
  const { slots } = mount(makeReact(undefined))
  // No title seat: the chip keeps the registry's captured text on one line. The prism
  // glyph that used to sit before it read as a warning triangle and wrapped narrow tabs.
  const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab.title')
  check('no custom chip rendering', entry === undefined, String(entry?.options?.key))
}

section('right sidebar tab body')
{
  const { slots, en } = mount(makeTabReact())
  const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab')
  check('body registered under the type id', entry?.options?.key === 'dsh-openprism-latex',
    String(entry?.options?.key))
  check('body is a component', typeof entry?.body === 'function')

  const props = (t, reactState) => ({
    t: key => t.get(key) ?? key,
    useTabInfo: () => ({ tab: { contentId: ADDRESS, signal: new AbortController().signal } }),
  })

  const compiling = entry.body(props(en))
  const nodes = flatten(compiling)
  check('tab root', nodes[0]?.props?.className === 'oprilx-tabroot', String(nodes[0]?.props?.className))
  check('view switch', nodes.some(node => node.props?.role === 'group'
    && node.props['aria-label'] === 'View mode'))
  check('toolbar status', nodes.some(node => node.props?.className === 'oprilx-tabstatus'
    && node.props?.role === 'status'))
  check('status tone dot', nodes.some(node => node.props?.className === 'oprilx-dot'
    && node.props?.['data-state'] === 'compiling'))
  const modeButtons = nodes.filter(node => node.props?.className === 'oprilx-mode')
  check('three modes', modeButtons.length === 3, String(modeButtons.length))
  check('preview is the default', modeButtons[0]?.props?.['aria-pressed'] === true)
  check('every mode has an accessible name', modeButtons.every(button =>
    typeof button.props['aria-label'] === 'string' && button.props['aria-label'] !== ''),
  JSON.stringify(modeButtons.map(button => button.props['aria-label'])))
  check('every mode draws a symbol', modeButtons.every(button =>
    flatten(button).some(node => node.type === 'svg' && node.props.width === 15)))
  check('symbols carry a tooltip', modeButtons.every(button =>
    typeof button.props.title === 'string' && button.props.title !== ''),
  JSON.stringify(modeButtons.map(button => button.props.title)))
  const splitIcon = flatten(modeButtons[2]).find(node => node.type === 'svg')
  check('split symbol has two panes', flatten(splitIcon).filter(node => node.type === 'path'
    || node.type === 'rect').length === 3,
  String(flatten(splitIcon).length))
  check('compiling status', nodes.some(node => node.props?.role === 'status'))
}

section('right sidebar tab body: error state')
{
  const errorState = {
    status: 'error',
    error: { code: 'latex-error', message: 'Undefined control sequence', line: 7, logTail: '! x' },
  }
  const { slots, en } = mount(makeTabReact({ state: errorState }))
  const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab')
  const tree = entry.body({
    t: key => en.get(key) ?? key,
    useTabInfo: () => ({ tab: { contentId: ADDRESS, signal: new AbortController().signal } }),
  })
  const text = textOf(tree)
  check('error message shown', text.includes('LaTeX reported an error'), text.slice(0, 200))
  check('log tail shown', text.includes('Undefined control sequence'))
  check('retry offered', flatten(tree).some(node => node.type === 'button'
    && node.props['aria-label'] === 'Retry'))
}

section('right sidebar tab body: error report actions')
{
  const errorState = {
    status: 'error',
    error: { code: 'latex-error', message: 'Paragraph ende', line: 42, logTail: '! Emergency stop.' },
  }
  const sent = []
  const inputActions = {
    captureInsertion: () => ({ rev: 3 }),
    insertText: (text) => { sent.push(text); return true },
  }
  const { slots, en } = mount(makeTabReact({ state: errorState }))
  const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab')
  const tree = entry.body({
    t: key => en.get(key) ?? key,
    useTabInfo: () => ({ tab: { contentId: ADDRESS, signal: new AbortController().signal } }),
    inputActions,
  })
  const nodes = flatten(tree)
  const copy = nodes.find(node => node.type === 'button' && node.props['aria-label'] === 'Copy the error')
  const send = nodes.find(node => node.type === 'button'
    && node.props['aria-label'] === 'Send the error to the chat')
  check('copy action offered', copy !== undefined)
  check('send action offered', send !== undefined)
  let copyError = ''
  try {
    copy.props.onClick()
  } catch (error) {
    copyError = `${error?.message} @ ${String(error?.stack ?? '').split('\n')[1] ?? ''}`
  }
  check('copy click does not throw', copyError === '', copyError)
  send.props.onClick()
  check('send inserts one report', sent.length === 1, String(sent.length))
  const jump = nodes.find(node => node.type === 'button'
    && String(node.props['aria-label']).startsWith('Jump to line'))
  check('error line is a jump control', jump !== undefined)
  check('jump names the line', jump?.props?.['aria-label'] === 'Jump to line 42',
    String(jump?.props?.['aria-label']))
  check('report is actionable', sent[0].includes('demo/example.tex')
    && sent[0].includes('line 42') && sent[0].includes('Paragraph ende')
    && sent[0].includes('```log'), JSON.stringify(sent[0]?.slice(0, 200)))
}

section('right sidebar tab body: preview state')
{
  const readyState = {
    status: 'ready',
    pages: [{ url: 'blob:t1', width: 1191, height: 1684 }, { url: 'blob:t2', width: 1191, height: 1684 }],
    pageCount: 2,
    durationMs: 800,
    dpi: 144,
    pdfUrl: 'api/dsh-openprism-latex/pdf?session=sess-1&path=demo/example.tex',
    truncated: false,
  }
  const { slots, en } = mount(makeTabReact({ state: readyState }))
  const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab')
  const tree = entry.body({
    t: key => en.get(key) ?? key,
    useTabInfo: () => ({ tab: { contentId: ADDRESS, signal: new AbortController().signal } }),
  })
  const images = flatten(tree).filter(node => node.type === 'img')
  const text = textOf(tree)
  check('both pages rendered in the pane', images.length === 2, String(images.length))
  check('page source', images[0]?.props?.src === 'blob:t1', String(images[0]?.props?.src))
  check('ready status text', textOf(tree).includes('2 pages'), textOf(tree).slice(0, 160))
  check('download symbol rendered', flatten(tree).some(node => node.props?.className === 'oprilx-glyph'))
  check('meta line', text.includes('2 pages') && text.includes('0.8'), text.slice(0, 200))
  check('download available', flatten(tree).some(node => node.type === 'button'
    && node.props['aria-label'] === 'Download PDF'))
}

section('right sidebar tab body: source mode')
{
  const text = '\\documentclass[11pt]{article}\nhello'
  const source = { status: 'ready', path: 'demo/example.tex', text, version: '12-345', truncated: false }
  const { slots, en } = mount(makeTabReact({ mode: 'source', source }))
  const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab')
  const tree = entry.body({
    t: key => en.get(key) ?? key,
    useTabInfo: () => ({ tab: { contentId: ADDRESS, signal: new AbortController().signal } }),
  })
  const nodes = flatten(tree)
  const area = nodes.find(node => node.type === 'textarea')
  check('editor textarea', area !== undefined)
  check('editor holds the source', area?.props?.defaultValue === text,
    JSON.stringify(area?.props?.defaultValue))
  // Uncontrolled textarea: a `value` prop would make React rewrite the DOM on every
  // keystroke and drop the browser's native undo stack (⌘Z).
  check('editor stays uncontrolled', area?.props?.value === undefined, String(area?.props?.value))
  check('editor is labelled', typeof area?.props?.['aria-label'] === 'string'
    && area.props['aria-label'].length > 0)
  const codeLines = nodes.filter(node => node.props?.className === 'oprilx-codeline')
  check('highlight layer per line', codeLines.length === 2, String(codeLines.length))
  check('tokens in the layer', nodes.some(node => node.props?.className === 'oprilx-tok'))
  const tokenTypes = new Set(nodes.filter(node => node.props?.className === 'oprilx-tok')
    .map(node => node.props?.['data-type']))
  check('control sequences tokenized', tokenTypes.has('command'), [...tokenTypes].join(','))
  check('optional arguments tokenized', tokenTypes.has('option'), [...tokenTypes].join(','))
  check('braces tokenized', tokenTypes.has('bracket'), [...tokenTypes].join(','))
  const gutter = nodes.filter(node => node.props?.className === 'oprilx-gutter')
  check('gutter column', gutter.length === 1, String(gutter.length))
  check('gutter numbers', flatten(gutter[0]).filter(node => typeof node.text === 'string' && node.text === '1').length >= 1)
  check('no page images in source mode', nodes.every(node => node.type !== 'img'))
  check('save hidden without edits', !nodes.some(node => node.props?.className === 'oprilx-save-button'))
  check('compile control present', nodes.some(node => node.type === 'button'
    && String(node.props['aria-label']).startsWith('Compile')))
}

section('right sidebar tab body: latex token classes')
{
  const text = [
    '\\usepackage[utf8]{inputenc}',
    '\\begin{itemize}',
    '  % a comment',
    '  \\item $x^2 + \\frac{1}{2}$',
    '\\end{itemize}',
    '\\section{Heading}',
  ].join('\n')
  const source = { status: 'ready', path: 'demo/example.tex', text, version: '9-9', truncated: false }
  const { slots, en } = mount(makeTabReact({ mode: 'source', source }))
  const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab')
  const tree = entry.body({
    t: key => en.get(key) ?? key,
    useTabInfo: () => ({ tab: { contentId: ADDRESS, signal: new AbortController().signal } }),
  })
  const types = new Set(flatten(tree)
    .filter(node => node.props?.className === 'oprilx-tok')
    .map(node => node.props['data-type']))
  for (const type of ['command', 'option', 'bracket', 'environment', 'comment', 'math', 'section']) {
    check(`token class ${type}`, types.has(type), [...types].join(','))
  }
}

section('right sidebar tab body: error without a line')
{
  const errorState = { status: 'error', error: { code: 'network' } }
  const { slots, en } = mount(makeTabReact({ state: errorState }))
  const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab')
  const tree = entry.body({
    t: key => en.get(key) ?? key,
    useTabInfo: () => ({ tab: { contentId: ADDRESS, signal: new AbortController().signal } }),
  })
  check('no jump control without a line', !flatten(tree).some(node => node.type === 'button'
    && String(node.props['aria-label'] ?? '').startsWith('Jump to line')))
}

section('right sidebar tab body: code font zoom')
{
  const text = '\\documentclass{article}'
  const source = { status: 'ready', path: 'demo/example.tex', text, version: '3-3', truncated: false }
  const { slots, en } = mount(makeTabReact({ mode: 'source', source }))
  const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab')
  const tree = entry.body({
    t: key => en.get(key) ?? key,
    useTabInfo: () => ({ tab: { contentId: ADDRESS, signal: new AbortController().signal } }),
  })
  const nodes = flatten(tree)
  const shell = nodes.find(node => node.props?.className === 'oprilx-editor-shell')
  check('type size variable', shell?.props?.style?.['--opr-code-size'] === '12px',
    JSON.stringify(shell?.props?.style))
  check('editor sits inside the shell', nodes.some(node => node.props?.className === 'oprilx-editor'))
  const area = nodes.find(node => node.type === 'textarea')
  const press = key => {
    let prevented = false
    area.props.onKeyDown({
      metaKey: true,
      key,
      preventDefault: () => { prevented = true },
      currentTarget: { selectionStart: 0, selectionEnd: 0, value: text },
    })
    return prevented
  }
  check('cmd+= intercepted (no page zoom)', press('=') === true)
  check('cmd+- intercepted', press('-') === true)
  check('cmd+0 intercepted', press('0') === true)
  check('cmd+f intercepted (no page find)', press('f') === true)
  check('cmd+g intercepted', press('g') === true)
  check('plain key not intercepted', press('a') === false)
  const engine = nodes.find(node => node.type === 'select')
  check('engine picker rendered', engine !== undefined)
  check('engine picker is labelled', engine?.props?.['aria-label'] === 'Engine',
    String(engine?.props?.['aria-label']))
  const choices = (engine?.props?.children ?? []).map(option => option.props.value)
  check('four engines offered', JSON.stringify(choices) === JSON.stringify(
    ['latexmk', 'pdflatex', 'xelatex', 'lualatex']), JSON.stringify(choices))
  check('latexmk is the default', engine?.props?.value === 'latexmk', String(engine?.props?.value))
}

section('right sidebar tab body: engine picker preference')
{
  const stored = {}
  globalThis.localStorage = {
    getItem: key => (key === 'dsh-openprism-latex.engine' ? 'xelatex' : null),
    setItem: (key, value) => { stored[key] = String(value) },
  }
  try {
    const source = { status: 'ready', path: 'demo/example.tex', text: '', version: '5-5', truncated: false }
    const { slots, en } = mount(makeTabReact({ mode: 'source', source }))
    const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab')
    const tree = entry.body({
      t: key => en.get(key) ?? key,
      useTabInfo: () => ({ tab: { contentId: ADDRESS, signal: new AbortController().signal } }),
    })
    const engine = flatten(tree).find(node => node.type === 'select')
    check('stored engine is selected', engine?.props?.value === 'xelatex',
      String(engine?.props?.value))
    engine.props.onChange({ target: { value: 'lualatex' } })
    check('engine choice persists under its key', stored['dsh-openprism-latex.engine'] === 'lualatex',
      JSON.stringify(stored))
  } finally {
    delete globalThis.localStorage
  }
}

section('right sidebar tab body: engine reaches the render request')
{
  const requests = []
  const fetch = url => {
    requests.push(String(url))
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, error: { code: 'network' } }),
    })
  }
  const render = react => {
    const { slots, en } = mount(react, { fetch })
    const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab')
    return entry.body({
      t: key => en.get(key) ?? key,
      useTabInfo: () => ({ tab: { contentId: ADDRESS, signal: new AbortController().signal } }),
    })
  }
  render({ ...makeTabReact(), useEffect(fn) { fn() } })
  check('default engine is requested', String(requests[0]).includes('engine=latexmk'),
    String(requests[0]))
  globalThis.localStorage = {
    getItem: key => (key === 'dsh-openprism-latex.engine' ? 'xelatex' : null),
    setItem: () => {},
  }
  try {
    render({ ...makeTabReact(), useEffect(fn) { fn() } })
  } finally {
    delete globalThis.localStorage
  }
  check('stored engine is requested', String(requests[1]).includes('engine=xelatex'),
    String(requests[1]))
}

section('right sidebar tab body: bracket editing')
{
  const source = { status: 'ready', path: 'demo/example.tex', text: '', version: '5-5', truncated: false }
  const { slots, en } = mount(makeTabReact({ mode: 'source', source }))
  const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab')
  const tree = entry.body({
    t: key => en.get(key) ?? key,
    useTabInfo: () => ({ tab: { contentId: ADDRESS, signal: new AbortController().signal } }),
  })
  const area = flatten(tree).find(node => node.type === 'textarea')
  const makeArea = (value, start, end = start) => ({
    value,
    selectionStart: start,
    selectionEnd: end,
    setSelectionRange(nextStart, nextEnd) {
      this.selectionStart = nextStart
      this.selectionEnd = nextEnd
    },
  })
  const press = (target, key) => {
    let prevented = false
    area.props.onKeyDown({
      key,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: () => { prevented = true },
      currentTarget: target,
    })
    return prevented
  }

  const braces = makeArea('', 0)
  check('typing { auto-closes', press(braces, '{') === true)
  check('closer inserted', braces.value === '{}', JSON.stringify(braces.value))
  check('caret sits inside the pair', braces.selectionStart === 1, String(braces.selectionStart))

  const wrapped = makeArea('x', 0, 1)
  press(wrapped, '(')
  check('selection is wrapped', wrapped.value === '(x)', JSON.stringify(wrapped.value))

  const skip = makeArea('{}', 1)
  check('closer steps over', press(skip, '}') === true && skip.selectionStart === 2
    && skip.value === '{}', `${skip.selectionStart} ${JSON.stringify(skip.value)}`)

  const backspace = makeArea('{}', 1)
  check('backspace removes an empty pair', press(backspace, 'Backspace') === true
    && backspace.value === '', JSON.stringify(backspace.value))

  const indent = makeArea('  item', 6)
  press(indent, 'Enter')
  check('enter keeps indentation', indent.value === '  item\n  ', JSON.stringify(indent.value))
}

section('right sidebar tab body: dirty draft')
{
  const source = { status: 'ready', path: 'demo/example.tex', text: 'one', version: '12-345', truncated: false }
  const { slots, en } = mount(makeTabReact({ mode: 'source', source, draft: 'one two' }))
  const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab')
  const tree = entry.body({
    t: key => en.get(key) ?? key,
    useTabInfo: () => ({ tab: { contentId: ADDRESS, signal: new AbortController().signal } }),
  })
  const nodes = flatten(tree)
  check('draft is shown', nodes.find(node => node.type === 'textarea')?.props?.defaultValue === 'one two')
  check('save appears for unsaved changes', nodes.some(node => node.props?.className === 'oprilx-save-button'
    && node.props['aria-label'].startsWith('Save')))
}

section('right sidebar tab body: save conflict')
{
  const source = { status: 'ready', path: 'demo/example.tex', text: 'one', version: '12-345', truncated: false }
  const { slots, en } = mount(makeTabReact({
    mode: 'split', source, draft: 'one two', save: { status: 'conflict' },
  }))
  const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab')
  const tree = entry.body({
    t: key => en.get(key) ?? key,
    useTabInfo: () => ({ tab: { contentId: ADDRESS, signal: new AbortController().signal } }),
  })
  const text = textOf(tree)
  check('conflict banner', text.includes('Changed on disk'), text.slice(0, 200))
  check('reload action', flatten(tree).some(node => node.type === 'button'
    && node.props['aria-label'] === 'Reload from disk'))
}

section('right sidebar tab body: refresh keeps pages with a progress line')
{
  const readyState = {
    status: 'ready',
    refreshing: true,
    pages: [{ url: 'blob:t1', width: 1191, height: 1684 }],
    pageCount: 1,
    durationMs: 400,
    dpi: 144,
    pdfUrl: 'api/dsh-openprism-latex/pdf?session=sess-1&path=demo/example.tex',
    truncated: false,
  }
  const { slots, en } = mount(makeTabReact({ state: readyState }))
  const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab')
  const tree = entry.body({
    t: key => en.get(key) ?? key,
    useTabInfo: () => ({ tab: { contentId: ADDRESS, title: 'example.tex', signal: new AbortController().signal } }),
  })
  const nodes = flatten(tree)
  check('pages stay visible', nodes.some(node => node.type === 'img'))
  check('progress line', nodes.some(node => node.props?.className === 'oprilx-progress'
    && node.props?.role === 'progressbar'))
  check('refreshing tone', nodes.some(node => node.props?.className === 'oprilx-dot'
    && node.props?.['data-state'] === 'compiling'))
}

section('right sidebar tab body: side-by-side mode')
{
  const readyState = {
    status: 'ready',
    pages: [{ url: 'blob:t1', width: 1191, height: 1684 }],
    pageCount: 1,
    durationMs: 400,
    dpi: 144,
    pdfUrl: '',
    truncated: false,
  }
  const source = { status: 'ready', path: 'demo/example.tex', text: 'line one', truncated: false }
  const { slots, en } = mount(makeTabReact({ mode: 'split', state: readyState, source }))
  const entry = slots.find(candidate => candidate.options?.name === 'sidebar.right.pane.tab')
  const tree = entry.body({
    t: key => en.get(key) ?? key,
    useTabInfo: () => ({ tab: { contentId: ADDRESS, signal: new AbortController().signal } }),
  })
  const panes = flatten(tree).filter(node => node.props?.className === 'oprilx-pane')
  check('two panes', panes.length === 2, String(panes.length))
  check('pane split container', flatten(tree).some(node => node.props?.className === 'oprilx-split'))
  check('source pane present', panes.some(node => node.props?.['data-pane'] === 'source'))
  check('preview pane present', panes.some(node => node.props?.['data-pane'] === 'preview'))
  check('page image in the split', flatten(tree).some(node => node.type === 'img'))
}

section(failures === 0 ? 'PASS — all checks green' : `FAIL — ${failures} check(s) failed`)
process.exitCode = failures === 0 ? 0 : 1
