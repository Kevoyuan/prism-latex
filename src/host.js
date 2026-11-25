/**
 * dsh-openprism-latex — Host half.
 *
 * Compiles a `.tex` file with the machine's TeX Live (in the file's own
 * directory, so `\input` and relative paths behave like a local build) and
 * rasterizes the PDF with Ghostscript. Two read-only HTTP resources are
 * mounted on DSH's own web server: `/render` (JSON pages) and `/pdf` (the
 * compiled PDF). Nothing is written to the workspace; every build happens in
 * a throwaway temp directory.
 *
 * Plain ESM. Node built-ins only. No runtime dependencies.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const inject = ['webServer']

const RENDER_PATH = '/api/dsh-openprism-latex/render'
const PDF_PATH = '/api/dsh-openprism-latex/pdf'
const FILES_PATH = '/api/dsh-openprism-latex/files'
const SOURCE_PATH = '/api/dsh-openprism-latex/source'
const SYNCTEX_PATH = '/api/dsh-openprism-latex/synctex'
const WRITE_PATH = '/api/dsh-openprism-latex/write'
/** Largest editor save accepted, in bytes of UTF-8 source. */
const MAX_WRITE_BYTES = 8 * 1024 * 1024
const ENGINES = ['pdflatex', 'xelatex', 'lualatex', 'latexmk']
/**
 * latexmk drives the engine as many times as the document needs and runs BibTeX on
 * its own, which is the difference between resolved and unresolved references. When
 * it is not installed the resolver falls back to a single pdflatex run.
 */
const DEFAULT_ENGINE = 'latexmk'
/** Engine used when the requested one is missing from this machine. */
const ENGINE_FALLBACK = 'pdflatex'
const TEX_EXTENSIONS = new Set(['.tex', '.latex', '.ltx'])
const TEMP_PREFIX = 'dsh-openprism-latex-'
const OUTPUT_CAP = 64 * 1024
const LOG_TAIL_BYTES = 8 * 1024
const PNG_BUDGET = 40 * 1024 * 1024
/** Characters of source one source read returns; longer files are cut, never silently whole. */
const SOURCE_TEXT_LIMIT = 1024 * 1024
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const SYSTEM_PATH = '/usr/bin:/bin:/usr/sbin:/sbin'

/** Error codes whose HTTP status differs between the render and pdf routes. */
const PDF_FAILURE_STATUS = {
  'bad-request': 400,
  forbidden: 403,
  'not-found': 404,
  'no-workspace': 503,
  'too-large': 413,
  'engine-missing': 503,
  'synctex-missing': 501,
  'no-synctex-match': 404,
  'outside-workspace': 403,
  'rasterizer-missing': 503,
  'latex-error': 500,
  'rasterize-failed': 500,
  timeout: 504,
  internal: 500,
}

/**
 * Cordis plugin entry. Registers one guarded HTTP resource per route.
 *
 * @param {import('cordis').Context} ctx
 * @param {Record<string, unknown>} [config]
 */
export function apply(ctx, config = {}) {
  const settings = normalizeConfig(config)
  const cache = new Map()
  const compileFlights = new Map()
  const rasterFlights = new Map()
  const resolved = new Map()

  const shared = {
    ctx,
    settings,
    cache,
    compileFlights,
    rasterFlights,
    resolved,
    // Work directories kept for inverse search, one per compiled document, bounded.
    synctexArtifacts: new Map(),
  }

  const renderRoute = {
    kind: 'exact',
    path: RENDER_PATH,
    resource: request => respond(shared, request, 'render'),
  }
  const pdfRoute = {
    kind: 'exact',
    path: PDF_PATH,
    resource: request => respond(shared, request, 'pdf'),
  }

  ctx.effect(() => ctx.webServer.register(renderRoute))
  ctx.effect(() => ctx.webServer.register(pdfRoute))
  const filesRoute = {
    kind: 'exact',
    path: FILES_PATH,
    resource: request => respond(shared, request, 'files'),
  }
  ctx.effect(() => ctx.webServer.register(filesRoute))
  const sourceRoute = {
    kind: 'exact',
    path: SOURCE_PATH,
    resource: request => respond(shared, request, 'source'),
  }
  ctx.effect(() => ctx.webServer.register(sourceRoute))
  const synctexRoute = {
    kind: 'exact',
    path: SYNCTEX_PATH,
    resource: request => respond(shared, request, 'synctex'),
  }
  ctx.effect(() => ctx.webServer.register(synctexRoute))
  const writeRoute = {
    kind: 'exact',
    path: WRITE_PATH,
    handler: (req, res) => handleWrite(shared, req, res),
  }
  ctx.effect(() => ctx.webServer.register(writeRoute))
}

/* --------------------------------------------------------------------------
 * Configuration
 * ------------------------------------------------------------------------ */

function normalizeConfig(raw) {
  const input = raw && typeof raw === 'object' ? raw : {}
  return {
    engine: normalizeEngine(input.engine),
    enginePath: normalizeOptionalPath(input.enginePath),
    ghostscriptPath: normalizeOptionalPath(input.ghostscriptPath),
    dpi: Math.round(clampNumber(input.dpi, 144, 96, 300)),
    maxPages: Math.max(1, Math.floor(numberFrom(input.maxPages, 50))),
    timeoutMs: Math.max(1, Math.floor(numberFrom(input.timeoutMs, 60000))),
    maxSourceBytes: Math.max(0, Math.floor(numberFrom(input.maxSourceBytes, 4 * 1024 * 1024))),
    cacheEntries: Math.max(0, Math.floor(numberFrom(input.cacheEntries, 8))),
    extraPathDirs: normalizeExtraPathDirs(input.extraPathDirs),
  }
}

function normalizeEngine(value) {
  if (typeof value !== 'string') return DEFAULT_ENGINE
  const engine = value.trim()
  return ENGINES.includes(engine) ? engine : DEFAULT_ENGINE
}

function normalizeOptionalPath(value) {
  if (typeof value !== 'string') return undefined
  const candidate = value.trim()
  if (candidate === '') return undefined
  return path.resolve(candidate)
}

function normalizeExtraPathDirs(value) {
  if (!Array.isArray(value)) return []
  const dirs = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const dir = entry.trim()
    if (dir !== '') dirs.push(path.resolve(dir))
  }
  return dirs
}

function numberFrom(value, fallback) {
  let numeric = Number.NaN
  if (typeof value === 'number') numeric = value
  else if (typeof value === 'string' && value.trim() !== '') numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function clampNumber(value, fallback, min, max) {
  return Math.min(max, Math.max(min, numberFrom(value, fallback)))
}

/* --------------------------------------------------------------------------
 * Executable discovery
 * ------------------------------------------------------------------------ */

function isExecutableFile(candidate) {
  try {
    if (!fs.statSync(candidate).isFile()) return false
    fs.accessSync(candidate, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

function findExecutableOnPath(name) {
  const entries = String(process.env.PATH ?? '')
    .split(path.delimiter)
    .filter(entry => entry !== '')
  for (const dir of entries) {
    const candidate = path.join(dir, name)
    if (isExecutableFile(candidate)) return candidate
  }
  return undefined
}

function listDirectories(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
  } catch {
    return []
  }
}

function byVersionDesc(a, b) {
  return b.localeCompare(a, 'en', { numeric: true })
}

/** `/usr/local/texlive/*\/bin/*\/<name>` and `/opt/homebrew/texlive/*\/bin/*\/<name>`, newest first. */
function texliveCandidates(name) {
  const candidates = []
  for (const base of ['/usr/local/texlive', '/opt/homebrew/texlive']) {
    for (const year of listDirectories(base).sort(byVersionDesc)) {
      const binDir = path.join(base, year, 'bin')
      for (const arch of listDirectories(binDir).sort(byVersionDesc)) {
        candidates.push(path.join(binDir, arch, name))
      }
    }
  }
  return candidates
}

function resolveEngine(engine, settings, cache) {
  const cacheKey = `engine:${engine}:${settings.enginePath ?? ''}`
  const cached = cache.get(cacheKey)
  if (cached !== undefined) return cached

  const candidates = []
  if (settings.enginePath !== undefined) candidates.push(settings.enginePath)
  const onPath = findExecutableOnPath(engine)
  if (onPath !== undefined) candidates.push(onPath)
  candidates.push(
    path.join('/Library/TeX/texbin', engine),
    path.join('/opt/homebrew/bin', engine),
    path.join('/usr/local/bin', engine),
  )
  candidates.push(...texliveCandidates(engine))

  for (const candidate of candidates) {
    if (isExecutableFile(candidate)) {
      cache.set(cacheKey, candidate)
      return candidate
    }
  }
  return undefined
}

/**
 * Resolve the engine to run, falling back to pdflatex when latexmk is not installed.
 *
 * @returns `{ engine, path }` where `engine` is what actually runs, or undefined.
 */
function resolveEngineWithFallback(settings, cache, engine) {
  const direct = resolveEngine(engine, settings, cache)
  if (direct !== undefined) return { engine, path: direct }
  if (engine === DEFAULT_ENGINE) {
    const fallback = resolveEngine(ENGINE_FALLBACK, settings, cache)
    if (fallback !== undefined) return { engine: ENGINE_FALLBACK, path: fallback }
  }
  return undefined
}

function resolveGhostscript(settings, cache) {
  const cacheKey = `gs:${settings.ghostscriptPath ?? ''}`
  const cached = cache.get(cacheKey)
  if (cached !== undefined) return cached

  const candidates = []
  if (settings.ghostscriptPath !== undefined) candidates.push(settings.ghostscriptPath)
  const onPath = findExecutableOnPath('gs')
  if (onPath !== undefined) candidates.push(onPath)
  candidates.push('/opt/homebrew/bin/gs', '/usr/local/bin/gs', '/usr/bin/gs')

  for (const candidate of candidates) {
    if (isExecutableFile(candidate)) {
      cache.set(cacheKey, candidate)
      return candidate
    }
  }
  return undefined
}

function buildChildEnv(enginePath, ghostscriptPath, extraPathDirs) {
  const parts = []
  if (enginePath !== undefined) parts.push(path.dirname(enginePath))
  if (ghostscriptPath !== undefined) parts.push(path.dirname(ghostscriptPath))
  parts.push(...extraPathDirs)
  if (typeof process.env.PATH === 'string' && process.env.PATH !== '') parts.push(process.env.PATH)
  parts.push(SYSTEM_PATH)
  return { ...process.env, PATH: parts.join(path.delimiter) }
}

/* --------------------------------------------------------------------------
 * Request handling
 * ------------------------------------------------------------------------ */

async function respond(shared, request, mode) {
  try {
    return await handleRequest(shared, request, mode)
  } catch (error) {
    try {
      shared.ctx.logger?.warn?.(`[dsh-openprism-latex] ${mode} request failed`, error)
    } catch {
      /* logging must never break the response */
    }
    return jsonResponse(
      request,
      errorBody('internal', error?.message ? String(error.message) : String(error)),
      500,
    )
  }
}

async function handleRequest(shared, request, mode) {
  const { ctx, settings } = shared

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return jsonResponse(request, errorBody('bad-request', 'Only GET and HEAD are supported.'), 400)
  }

  const origin = checkOrigin(ctx, request)
  if (!origin.ok) return jsonResponse(request, errorBody('forbidden', origin.message), 403)

  let url
  try {
    url = new URL(request.url)
  } catch {
    return jsonResponse(request, errorBody('bad-request', 'Malformed request URL.'), 400)
  }

  const params = url.searchParams
  // A Client diagnostic report rides any route; it must never depend on a Session.
  recordDiagnostic(params.get('diag'))
  const sessionId = (params.get('session') ?? '').trim()
  const requestedPath = params.get('path') ?? ''
  if (sessionId === '') {
    return jsonResponse(request, errorBody('bad-request', 'The "session" query parameter is required.'), 400)
  }
  const root = resolveWorkspaceRoot(ctx, sessionId)
  if (root === undefined) {
    return jsonResponse(
      request,
      errorBody('no-workspace', `No workspace directory is available for session "${sessionId}".`),
      503,
    )
  }

  if (mode === 'files') {
    const files = listTexDocuments(root)
    return jsonResponse(request, { ok: true, root, files }, 200)
  }
  if (requestedPath.trim() === '') {
    return jsonResponse(request, errorBody('bad-request', 'The "path" query parameter is required.'), 400)
  }


  const engine = engineForRequest(params, settings)
  const target = inspectTarget(requestedPath, root, settings)
  if (!target.ok) {
    return jsonResponse(request, errorBody(target.code, target.message), target.status)
  }

  if (mode === 'source') {
    if (target.stat.size > settings.maxSourceBytes) {
      return jsonResponse(
        request,
        errorBody('too-large', 'The source is larger than the configured preview limit.'),
        200,
      )
    }
    let text
    try {
      text = fs.readFileSync(target.real, 'utf8')
    } catch (error) {
      return jsonResponse(
        request,
        errorBody('not-found', error?.message ? String(error.message) : 'The source could not be read.'),
        200,
      )
    }
    return jsonResponse(request, {
      ok: true,
      path: requestedPath,
      text: text.length > SOURCE_TEXT_LIMIT ? text.slice(0, SOURCE_TEXT_LIMIT) : text,
      truncated: text.length > SOURCE_TEXT_LIMIT,
      version: `${target.stat.size}-${target.stat.mtimeMs}`,
    }, 200)
  }

  const version = `${target.stat.size}-${target.stat.mtimeMs}`
  // Key the cache on what will actually run, so a latexmk request and the pdflatex
  // binary it falls back to never share pages, and switching back is never stale.
  const resolvedEngine = resolveEngineWithFallback(settings, shared.resolved, engine)
  const runEngine = resolvedEngine === undefined ? engine : resolvedEngine.engine
  const cacheKey = `${target.real}|${target.stat.mtimeMs}|${target.stat.size}|${runEngine}`
  const startedAt = Date.now()
  const compileContext = { key: cacheKey, engine: runEngine, texPath: target.real, version }

  if (mode === 'pdf') {
    const compiled = await getCompiled(shared, compileContext)
    if (compiled.failure !== undefined) {
      return failureResponse(request, compiled.failure, mode)
    }
    const base = path.basename(target.real, path.extname(target.real)) || 'document'
    const filename = `${base.replace(/["\\]/g, '_')}.pdf`
    return rawResponse(request, compiled.entry.pdf, 200, {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${filename}"`,
      'cache-control': 'no-store',
    })
  }

  if (mode === 'synctex') {
    // A missing parameter must not read as 0: `Number(null)` is 0, and y = 0 is a
    // legitimate point on the top edge of the page.
    const numberParam = name => {
      const raw = params.get(name)
      return raw === null || raw.trim() === '' ? Number.NaN : Number(raw)
    }
    const page = numberParam('page')
    const x = numberParam('x')
    const y = numberParam('y')
    if (!Number.isFinite(page) || page < 1 || !Number.isFinite(x) || !Number.isFinite(y)) {
      return jsonResponse(request,
        errorBody('bad-request', 'The "page", "x" and "y" query parameters are required.'), 400)
    }
    const query = await runSynctexQuery(shared, { ...compileContext, root }, { page, x, y })
    if (query.failure !== undefined) return failureResponse(request, query.failure, mode)
    return jsonResponse(request, query.body, 200)
  }

  const compiled = await getCompiled(shared, compileContext)
  if (compiled.failure !== undefined) {
    return failureResponse(request, compiled.failure, mode)
  }

  const raster = await getRasterized(shared, compiled.entry, cacheKey)
  if (raster.failure !== undefined) {
    return failureResponse(request, raster.failure, mode)
  }

  const body = {
    ok: true,
    version,
    engine: compiled.entry.engine ?? engine,
    dpi: settings.dpi,
    durationMs: Date.now() - startedAt,
    pageCount: raster.pages.length,
    truncated: raster.truncated === true,
    pages: raster.pages,
    pdfUrl: buildPdfUrl(sessionId, requestedPath, engine),
  }
  return jsonResponse(request, body, 200)
}

function checkOrigin(ctx, request) {
  const site = request.headers.get('sec-fetch-site')
  if (site === 'cross-site' || site === 'same-site') {
    return { ok: false, message: 'Cross-site requests are not allowed.' }
  }

  const origin = request.headers.get('origin')
  if (origin === null) return { ok: true }

  const allowed = new Set()
  allowed.add(normalizeOrigin(request.url))
  try {
    const serverOrigin = ctx.webServer?.getOrigin?.()
    if (typeof serverOrigin === 'string' && serverOrigin !== '') {
      allowed.add(normalizeOrigin(serverOrigin))
    }
  } catch {
    /* without a server origin only the page origin is allowed */
  }

  if (allowed.has(normalizeOrigin(origin))) return { ok: true }
  return { ok: false, message: 'Request origin is not allowed.' }
}

function normalizeOrigin(value) {
  try {
    return new URL(String(value)).origin
  } catch {
    return String(value)
  }
}

function resolveWorkspaceRoot(ctx, sessionId) {
  const candidates = []
  try {
    const sessions = ctx.get('sessions')
    const session = typeof sessions?.get === 'function' ? sessions.get(sessionId) : undefined
    candidates.push(session?.header?.cwd)
  } catch {
    /* optional service */
  }
  try {
    candidates.push(ctx.get('sandboxPolicy')?.workspaceRoot)
  } catch {
    /* optional service */
  }

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.trim() === '') continue
    const absolute = path.resolve(candidate.trim())
    try {
      return fs.realpathSync(absolute)
    } catch {
      return absolute
    }
  }
  return undefined
}

/**
 * SPEC spells route 1's query key with a Cyrillic "е" in one place; accept both
 * spellings and fall back to the configured engine for unknown values.
 */
function engineForRequest(params, settings) {
  const requested = (params.get('engine') ?? params.get('enginе') ?? '').trim()
  return ENGINES.includes(requested) ? requested : settings.engine
}

function inspectTarget(requestedPath, root, settings) {
  const absolute = path.isAbsolute(requestedPath)
    ? requestedPath
    : path.resolve(root, requestedPath)
  const lexical = path.resolve(absolute)
  if (!isInside(root, lexical)) {
    return {
      ok: false,
      code: 'forbidden',
      status: 403,
      message: 'The requested file is outside the workspace.',
    }
  }

  if (!TEX_EXTENSIONS.has(path.extname(requestedPath).toLowerCase())) {
    return {
      ok: false,
      code: 'bad-request',
      status: 400,
      message: 'Only .tex, .latex and .ltx files can be previewed.',
    }
  }

  let real
  try {
    real = fs.realpathSync(lexical)
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      return { ok: false, code: 'not-found', status: 404, message: 'The requested file does not exist.' }
    }
    return {
      ok: false,
      code: 'forbidden',
      status: 403,
      message: 'The requested path cannot be resolved inside the workspace.',
    }
  }
  if (!isInside(root, real)) {
    return {
      ok: false,
      code: 'forbidden',
      status: 403,
      message: 'The requested file is outside the workspace.',
    }
  }

  let stat
  try {
    stat = fs.statSync(real)
  } catch {
    return { ok: false, code: 'not-found', status: 404, message: 'The requested file does not exist.' }
  }
  if (!stat.isFile()) {
    return { ok: false, code: 'bad-request', status: 400, message: 'The requested path is not a file.' }
  }
  if (settings.maxSourceBytes > 0 && stat.size > settings.maxSourceBytes) {
    return {
      ok: false,
      code: 'too-large',
      status: 400,
      message: `The .tex source is larger than the configured ${settings.maxSourceBytes}-byte limit.`,
    }
  }

  return { ok: true, real, stat }
}

/**
 * Answer one editor save: `POST` JSON `{ session, path, text, expectedVersion? }`.
 *
 * A node-style handler is required because the Fetch-style resource route only sees GET
 * and HEAD. The same guards as the read routes apply, plus a bounded body, an optional
 * optimistic version check, and an atomic replace so a failed write cannot truncate the
 * file the user is editing.
 *
 * @param shared - plugin state (context and settings).
 * @param req - IncomingMessage carrying the JSON body.
 * @param res - ServerResponse to answer on.
 */
async function handleWrite(shared, req, res) {
  const { ctx, settings } = shared
  const answer = (status, body) => {
    try {
      res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      })
      res.end(JSON.stringify(body))
    } catch {
      /* the client may have gone away */
    }
  }
  try {
    if (req.method !== 'POST') {
      answer(405, errorBody('bad-request', 'Only POST is supported here.'))
      return
    }
    const host = req.headers.host === undefined ? '127.0.0.1' : String(req.headers.host)
    const url = `http://${host}${req.url ?? WRITE_PATH}`
    const origin = checkOrigin(ctx, new Request(url, { headers: req.headers }))
    if (!origin.ok) {
      answer(403, errorBody('forbidden', origin.message))
      return
    }

    const raw = await readBody(req, MAX_WRITE_BYTES)
    let payload
    try {
      payload = JSON.parse(raw)
    } catch {
      answer(400, errorBody('bad-request', 'The request body is not JSON.'))
      return
    }
    const sessionId = typeof payload?.session === 'string' ? payload.session.trim() : ''
    const requestedPath = typeof payload?.path === 'string' ? payload.path : ''
    const text = typeof payload?.text === 'string' ? payload.text : undefined
    if (sessionId === '' || requestedPath.trim() === '' || text === undefined) {
      answer(400, errorBody('bad-request', 'The "session", "path" and "text" fields are required.'))
      return
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_WRITE_BYTES) {
      answer(413, errorBody('too-large', 'The source is larger than the editor limit.'))
      return
    }
    const root = resolveWorkspaceRoot(ctx, sessionId)
    if (root === undefined) {
      answer(503, errorBody('no-workspace', `No workspace directory is available for session "${sessionId}".`))
      return
    }
    const target = inspectTarget(requestedPath, root, settings)
    if (!target.ok) {
      answer(target.status, errorBody(target.code, target.message))
      return
    }
    const currentVersion = `${target.stat.size}-${target.stat.mtimeMs}`
    const expected = typeof payload?.expectedVersion === 'string' ? payload.expectedVersion : undefined
    if (expected !== undefined && expected !== '' && expected !== currentVersion) {
      answer(409, errorBody('source-changed',
        'The file changed on disk after this editor loaded it.',
        { currentVersion }))
      return
    }

    const directory = path.dirname(target.real)
    const temporary = path.join(directory, `.dsh-openprism-${process.pid}-${Date.now()}.tmp`)
    try {
      fs.writeFileSync(temporary, text, 'utf8')
      fs.renameSync(temporary, target.real)
    } catch (error) {
      try {
        fs.rmSync(temporary, { force: true })
      } catch {
        /* best effort */
      }
      answer(500, errorBody('write-failed', error?.message ? String(error.message) : 'The file could not be written.'))
      return
    }
    let stat
    try {
      stat = fs.statSync(target.real)
    } catch {
      stat = undefined
    }
    answer(200, {
      ok: true,
      path: requestedPath,
      version: stat === undefined ? '' : `${stat.size}-${stat.mtimeMs}`,
    })
  } catch (error) {
    answer(500, errorBody('internal', error?.message ? String(error.message) : String(error)))
  }
}

/** Read a bounded request body as UTF-8 text. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', chunk => {
      size += chunk.length
      if (size > limit) {
        reject(Object.assign(new Error('The request body is too large.'), { code: 'too-large' }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const SKIPPED_DIRECTORIES = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', '.next', '.nuxt', '.cache',
  '.venv', 'venv', '__pycache__', 'target', 'vendor', '.turbo', '.parcel-cache',
])

/**
 * List the workspace's LaTeX documents, newest names sorted for a stable panel order.
 *
 * A bounded breadth-first walk: hidden directories are skipped, only the suffixes this
 * plugin renders are kept, and both the visited-entry and result budgets stop a hostile
 * or enormous tree rather than stalling the request.
 *
 * @param root - absolute workspace root, already resolved.
 * @returns workspace-relative paths with `/` separators.
 */
function listTexDocuments(root, resultLimit = 200, visitedLimit = 8000) {
  const found = []
  const queue = ['']
  let visited = 0
  while (queue.length > 0 && found.length < resultLimit && visited < visitedLimit) {
    const relative = queue.shift()
    const directory = relative === '' ? root : path.join(root, relative)
    let entries
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (visited >= visitedLimit || found.length >= resultLimit) break
      const name = entry.name
      if (name.startsWith('.')) continue
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(name)) continue
        queue.push(relative === '' ? name : `${relative}/${name}`)
        continue
      }
      if (!entry.isFile()) continue
      visited += 1
      if (!TEX_EXTENSIONS.has(path.extname(name).toLowerCase())) continue
      found.push(relative === '' ? name : `${relative}/${name}`)
    }
  }
  return found.sort((left, right) => left.localeCompare(right, 'en', { numeric: true }))
}

/** Where a Client diagnostic report lands; the file is overwritten by each report. */
const DIAGNOSTIC_FILE = path.join(os.tmpdir(), 'dsh-openprism-latex-diag.json')

/**
 * Write one Client diagnostic report to a temp file for support.
 *
 * The browser cannot expose its registries to the Host otherwise; this route parameter is
 * read-only for the plugin and bounded, and a malformed report is ignored rather than
 * failing the listing request it rides on.
 *
 * @param encoded - base64-encoded JSON from `btoa(JSON.stringify(report))`.
 */
function recordDiagnostic(encoded) {
  if (typeof encoded !== 'string' || encoded === '' || encoded.length > 65536) return
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8')
    const parsed = JSON.parse(decoded)
    fs.writeFileSync(DIAGNOSTIC_FILE, JSON.stringify({
      at: new Date().toISOString(),
      pid: process.pid,
      report: parsed,
    }, null, 2))
  } catch {
    /* a bad report never fails the request it rides on */
  }
}

function isInside(root, target) {
  if (target === root) return true
  const prefix = root.endsWith(path.sep) ? root : root + path.sep
  return target.startsWith(prefix)
}

function buildPdfUrl(sessionId, requestedPath, engine) {
  const params = new URLSearchParams()
  params.set('session', sessionId)
  params.set('path', requestedPath)
  params.set('engine', engine)
  return `api/dsh-openprism-latex/pdf?${params.toString()}`
}

/* --------------------------------------------------------------------------
 * Cache
 * ------------------------------------------------------------------------ */

function cacheGet(cache, key) {
  const entry = cache.get(key)
  if (entry === undefined) return undefined
  cache.delete(key)
  cache.set(key, entry)
  return entry
}

function cacheSet(cache, settings, key, entry) {
  if (settings.cacheEntries <= 0) return
  cache.delete(key)
  cache.set(key, entry)
  while (cache.size > settings.cacheEntries) {
    const oldest = cache.keys().next()
    if (oldest.done === true) break
    cache.delete(oldest.value)
  }
}

async function getCompiled(shared, context) {
  const cached = cacheGet(shared.cache, context.key)
  if (cached !== undefined) return { entry: cached }

  const pending = shared.compileFlights.get(context.key)
  if (pending !== undefined) return pending

  const promise = (async () => {
    try {
      const resolvedEngine = resolveEngineWithFallback(shared.settings, shared.resolved, context.engine)
      if (resolvedEngine === undefined) {
        return {
          failure: {
            code: 'engine-missing',
            message: `The ${context.engine} executable was not found. Install TeX Live, or set "enginePath" in the dsh-openprism-latex configuration.`,
          },
        }
      }
      const enginePath = resolvedEngine.path
      const ghostscriptPath = resolveGhostscript(shared.settings, shared.resolved)
      const env = buildChildEnv(enginePath, ghostscriptPath, shared.settings.extraPathDirs)
      const result = await runCompile({
        engine: resolvedEngine.engine,
        enginePath,
        texPath: context.texPath,
        settings: shared.settings,
        env,
      })
      if (result.failure !== undefined) return { failure: result.failure }

      const entry = {
        version: context.version,
        // What actually ran: latexmk falls back to pdflatex on machines without it.
        engine: resolvedEngine.engine,
        pdf: result.pdf,
        pages: undefined,
        dpi: undefined,
        truncated: false,
        at: Date.now(),
        pageCount: result.pageCount,
      }
      cacheSet(shared.cache, shared.settings, context.key, entry)
      return { entry }
    } catch (error) {
      return {
        failure: {
          code: 'internal',
          status: 500,
          message: error?.message ? String(error.message) : String(error),
        },
      }
    } finally {
      shared.compileFlights.delete(context.key)
    }
  })()

  shared.compileFlights.set(context.key, promise)
  return promise
}

async function getRasterized(shared, entry, key) {
  const { settings } = shared
  if (Array.isArray(entry.pages) && entry.dpi === settings.dpi) {
    return { pages: entry.pages, truncated: entry.truncated === true }
  }

  const rasterKey = `${key}|${settings.dpi}`
  const pending = shared.rasterFlights.get(rasterKey)
  if (pending !== undefined) return pending

  const promise = (async () => {
    try {
      const ghostscriptPath = resolveGhostscript(settings, shared.resolved)
      if (ghostscriptPath === undefined) {
        return {
          failure: {
            code: 'rasterizer-missing',
            message:
              'Ghostscript (gs) was not found, so the PDF pages cannot be rendered. Install Ghostscript, or set "ghostscriptPath" in the dsh-openprism-latex configuration.',
          },
        }
      }
      const env = buildChildEnv(undefined, ghostscriptPath, settings.extraPathDirs)
      const result = await runRasterize({
        pdf: entry.pdf,
        settings,
        ghostscriptPath,
        env,
      })
      if (result.failure !== undefined) return { failure: result.failure }

      entry.pages = result.pages
      entry.dpi = settings.dpi
      entry.truncated =
        Number.isFinite(entry.pageCount) &&
        entry.pageCount > settings.maxPages &&
        result.pages.length >= settings.maxPages
      return { pages: entry.pages, truncated: entry.truncated }
    } catch (error) {
      return {
        failure: {
          code: 'rasterize-failed',
          message: error?.message ? String(error.message) : String(error),
        },
      }
    } finally {
      shared.rasterFlights.delete(rasterKey)
    }
  })()

  shared.rasterFlights.set(rasterKey, promise)
  return promise
}

/* --------------------------------------------------------------------------
 * Compile
 * ------------------------------------------------------------------------ */

function buildEngineArgs(engine, texPath, outputDir) {
  if (engine === 'latexmk') {
    return [
      '-pdf',
      '-interaction=nonstopmode',
      '-halt-on-error',
      '-file-line-error',
      '-no-shell-escape',
      '-synctex=1',
      `-outdir=${outputDir}`,
      texPath,
    ]
  }
  return [
    '-interaction=nonstopmode',
    '-halt-on-error',
    '-file-line-error',
    '-no-shell-escape',
    '-synctex=1',
    `-output-directory=${outputDir}`,
    texPath,
  ]
}

async function runCompile({ engine, enginePath, texPath, settings, env, keepWorkDir = false }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX))
  try {
    const base = path.basename(texPath, path.extname(texPath))
    const run = await runChildProcess(enginePath, buildEngineArgs(engine, texPath, tmp), {
      cwd: path.dirname(texPath),
      env,
      timeoutMs: settings.timeoutMs,
    })

    let log = ''
    let logTail = ''
    try {
      const logBytes = fs.readFileSync(path.join(tmp, `${base}.log`))
      log = logBytes.toString('utf8')
      logTail = tailBytes(logBytes, LOG_TAIL_BYTES)
    } catch {
      logTail = tailBytes(
        Buffer.from(`${run.stderr ?? ''}${run.stdout ?? ''}`),
        LOG_TAIL_BYTES,
      )
    }

    if (run.timedOut) {
      return {
        failure: {
          code: 'timeout',
          message: `LaTeX did not finish within ${settings.timeoutMs} ms and was stopped.`,
          logTail,
        },
      }
    }
    if (run.spawnError !== undefined) {
      if (run.spawnError?.code === 'ENOENT') {
        return {
          failure: {
            code: 'engine-missing',
            message: `The ${engine} executable was not found. Install TeX Live, or set "enginePath" in the dsh-openprism-latex configuration.`,
          },
        }
      }
      return {
        failure: {
          code: 'latex-error',
          message: `The LaTeX engine could not be started: ${run.spawnError?.message ?? 'unknown error'}`,
          logTail,
        },
      }
    }

    let pdf
    try {
      pdf = fs.readFileSync(path.join(tmp, `${base}.pdf`))
    } catch {
      pdf = undefined
    }
    if (pdf === undefined || pdf.length === 0) {
      const parsed = parseLogFailure(log, logTail)
      return {
        failure: {
          code: 'latex-error',
          message: parsed.message ?? 'LaTeX failed to produce a PDF',
          line: parsed.line,
          logTail,
        },
      }
    }

    return { pdf, pageCount: pdfPageCountFromLog(log), workDir: tmp }
  } finally {
    if (!keepWorkDir) {
      try {
        fs.rmSync(tmp, { recursive: true, force: true })
      } catch {
        /* best effort */
      }
    }
  }
}

/**
 * Compile once with positions recorded and keep the work directory, so inverse search
 * does not recompile per click. At most two documents are kept.
 *
 * @returns `{ workDir, pdfPath, synctexBinary }` or `{ failure }`.
 */
async function prepareSynctexArtifacts(shared, context) {
  const cached = shared.synctexArtifacts.get(context.key)
  if (cached !== undefined) return cached

  const promise = (async () => {
    const resolvedEngine = resolveEngineWithFallback(shared.settings, shared.resolved, context.engine)
    if (resolvedEngine === undefined) {
      return {
        failure: { code: 'engine-missing', message: `The ${context.engine} executable was not found.` },
      }
    }
    const enginePath = resolvedEngine.path
    const ghostscriptPath = resolveGhostscript(shared.settings, shared.resolved)
    const env = buildChildEnv(enginePath, ghostscriptPath, shared.settings.extraPathDirs)
    const result = await runCompile({
      engine: resolvedEngine.engine,
      enginePath,
      texPath: context.texPath,
      settings: shared.settings,
      env,
      keepWorkDir: true,
    })
    if (result.failure !== undefined) return { failure: result.failure }
    const base = path.basename(context.texPath, path.extname(context.texPath))
    return {
      workDir: result.workDir,
      pdfPath: path.join(result.workDir, `${base}.pdf`),
      synctexBinary: path.join(path.dirname(enginePath), 'synctex'),
    }
  })()

  shared.synctexArtifacts.set(context.key, promise)
  while (shared.synctexArtifacts.size > 2) {
    const oldest = shared.synctexArtifacts.keys().next()
    if (oldest.done === true) break
    const evicted = shared.synctexArtifacts.get(oldest.value)
    shared.synctexArtifacts.delete(oldest.value)
    Promise.resolve(evicted).then(artifacts => {
      if (artifacts?.workDir === undefined) return
      try {
        fs.rmSync(artifacts.workDir, { recursive: true, force: true })
      } catch {
        /* best effort */
      }
    }).catch(() => {})
  }
  return promise
}

/**
 * Inverse search: the source position rendered at one PDF point.
 *
 * Coordinates arrive in PDF points from the page's top-left corner, which is what
 * `synctex edit -o page:x:y:pdf` expects; the Client converts pixels with the dpi it
 * received from the render response.
 *
 * @returns `{ body }` with `{ ok, path, line }`, or `{ failure }`.
 */
async function runSynctexQuery(shared, context, point) {
  const artifacts = await prepareSynctexArtifacts(shared, context)
  if (artifacts.failure !== undefined) return { failure: artifacts.failure }
  if (!isExecutableFile(artifacts.synctexBinary)) {
    return {
      failure: {
        code: 'synctex-missing',
        message: 'The synctex tool was not found next to the LaTeX engine.',
      },
    }
  }
  const spec = `${point.page}:${point.x.toFixed(2)}:${point.y.toFixed(2)}:${artifacts.pdfPath}`
  const run = await runChildProcess(artifacts.synctexBinary, ['edit', '-o', spec], {
    cwd: artifacts.workDir,
    env: process.env,
    timeoutMs: 15000,
  })
  if (run.spawnError !== undefined) {
    return {
      failure: {
        code: 'synctex-missing',
        message: `synctex could not be started: ${run.spawnError?.message ?? 'unknown error'}`,
      },
    }
  }
  const stdout = String(run.stdout ?? '')
  const input = /^Input:(.+)$/m.exec(stdout)
  const line = /^Line:(-?\d+)$/m.exec(stdout)
  if (input === null || line === null || run.timedOut) {
    return {
      failure: { code: 'no-synctex-match', message: 'No source position matches that spot.' },
    }
  }
  const absolute = path.resolve(input[1].trim())
  const relative = path.relative(context.root, absolute)
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    return {
      failure: {
        code: 'outside-workspace',
        message: 'That page position belongs to a file outside the workspace.',
      },
    }
  }
  const sourceLine = Number(line[1])
  const resolvedLine = Number.isFinite(sourceLine) && sourceLine > 0 ? sourceLine : 1
  const reportedColumn = /^Column:(\d+)$/m.exec(stdout)
  const refined = reportedColumn === null
    ? await refineSynctexColumn(artifacts.synctexBinary, artifacts, absolute, resolvedLine, point.x)
    : { column: Number(reportedColumn[1]), debug: { reported: Number(reportedColumn[1]) } }
  const column = Number.isFinite(refined.column) && refined.column >= 0 ? refined.column : 0
  return {
    body: {
      ok: true,
      path: relative,
      line: resolvedLine,
      column,
      // The inputs behind the estimate: a constant bias shows up here as a wrong origin.
      debug: { ...refined.debug, clickX: point.x, clickY: point.y },
    },
  }
}

/**
 * Estimate the character column inside a line from the clicked x.
 *
 * TeX records one box per line (`h`, `W`), not per glyph, so the click is mapped by
 * proportion and then snapped to the nearest word or command boundary. A caret inside a
 * word would be wrong more often than a caret at its start.
 *
 * @param lineText - the source line, without the newline.
 * @param fraction - 0 at the line's left edge, 1 at its right edge.
 * @returns a 0-based column in that line.
 */
/* pairing: columnFromFraction — kept pure so the mapping can be tested without TeX. */
/**
 * Commands that print text of their own, with how many characters they print.
 *
 * `\\LaTeX` and `\\pi` occupy page width, so treating the whole control sequence as
 * invisible shifted the caret left by exactly their width. Commands that wrap their argument
 * (`\\textbf`, `\\emph`, `\\texttt`, sectioning, environments) print nothing here: only
 * the argument does, and it is walked character by character below.
 */
const TYPESET_COMMANDS = new Map([
  ['LaTeX', 5], ['LaTeXe', 7], ['TeX', 3], ['XeTeX', 5], ['LuaTeX', 6], ['pdfTeX', 6],
  ['pi', 1], ['alpha', 1], ['beta', 1], ['gamma', 1], ['delta', 1], ['epsilon', 1],
  ['theta', 1], ['lambda', 1], ['mu', 1], ['nu', 1], ['xi', 1], ['rho', 1], ['sigma', 1],
  ['tau', 1], ['phi', 1], ['chi', 1], ['psi', 1], ['omega', 1], ['Gamma', 1],
  ['Delta', 1], ['Theta', 1], ['Lambda', 1], ['Xi', 1], ['Pi', 1], ['Sigma', 1],
  ['Phi', 1], ['Psi', 1], ['Omega', 1], ['infty', 1], ['times', 1], ['cdot', 1],
  ['pm', 1], ['leq', 1], ['geq', 1], ['neq', 1], ['approx', 1], ['rightarrow', 1],
  ['leftarrow', 1], ['ldots', 1], ['dots', 1], ['quad', 1], ['qquad', 1],
  ['LaTeX', 5],
])

/** Separator commands (`\\`, `\\[2pt]`) print no glyph of their own. */
const WRAPPER_ONLY = new Set([
  'textbf', 'textit', 'textsl', 'textsc', 'texttt', 'textrm', 'textsf', 'emph', 'underline',
  'textit', 'mbox', 'text', 'mathrm', 'mathbf', 'mathit', 'mathcal', 'mathbb', 'mathsf',
  'operatorname', 'section', 'subsection', 'subsubsection', 'paragraph', 'chapter', 'part',
  'title', 'author', 'date', 'maketitle', 'item', 'label', 'ref', 'cite', 'caption',
  'centering', 'noindent', 'indent', 'vspace', 'hspace', 'smallskip', 'medskip', 'bigskip',
  'begin', 'end', 'documentclass', 'usepackage', 'include', 'input', 'newcommand',
  'renewcommand', 'setlength', 'includegraphics', 'resizebox', 'hline', 'blindtext',
])

/**
 * The units that occupy page width on one source line.
 *
 * Each unit is `{ index, weight }`: the source offset the caret should land on and how many
 * characters of width it prints. Mapping the click over these weights is what keeps a line
 * with `\\LaTeX{}`, `\\texttt{.tex}`, `$e^{i\\pi} + 1 = 0$` or `\\emph{Fit}` in sync.
 */
function typesetUnits(lineText) {
  const units = []
  let index = 0
  while (index < lineText.length) {
    const char = lineText[index]
    if (char === '%') break
    if (char === '\\') {
      const next = lineText[index + 1]
      if (next !== undefined && /[A-Za-z@]/.test(next)) {
        let scan = index + 1
        while (scan < lineText.length && /[A-Za-z@]/.test(lineText[scan])) scan += 1
        const name = lineText.slice(index + 1, scan)
        // Optional `[...]` arguments never print.
        const optional = /^\s*\[[^\]]*\]/.exec(lineText.slice(scan))
        if (optional !== null) scan += optional[0].length
        const weight = TYPESET_COMMANDS.get(name)
        if (weight !== undefined && name !== 'quad' && name !== 'qquad') {
          units.push({ index, weight })
        } else if (weight !== undefined) {
          units.push({ index, weight })
        } else if (!WRAPPER_ONLY.has(name)) {
          // Unknown macros usually wrap or are definitions; assume they print nothing.
          // Their arguments are still walked below.
        }
        index = scan
        continue
      }
      if (next === undefined) {
        index += 1
        continue
      }
      // `\%`, `\_`, `\\`-style escapes print the symbol; a line break prints nothing.
      if (next === '\\') {
        index += 2
        continue
      }
      units.push({ index: index + 1, weight: 1 })
      index += 2
      continue
    }
    if (char === '{' || char === '}' || char === '$' || char === '&') {
      index += 1
      continue
    }
    if (char === '_' || char === '^' || char === '~') {
      index += 1
      continue
    }
    units.push({ index, weight: 1 })
    index += 1
  }
  return units
}

/** Character column the click belongs to, over the width the line actually prints. */
function columnFromFraction(lineText, fraction) {
  if (typeof lineText !== 'string' || lineText === '') return 0
  const clamped = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0))
  const units = typesetUnits(lineText)
  if (units.length === 0) {
    return Math.max(0, Math.min(lineText.length, Math.floor(clamped * lineText.length)))
  }
  let total = 0
  for (const unit of units) total += unit.weight
  const target = clamped * total
  let walked = 0
  for (const unit of units) {
    if (target < walked + unit.weight) return unit.index
    walked += unit.weight
  }
  return units[units.length - 1].index
}

/**
 * Refine a synctex hit to a character column: read the line and the box, then map the
 * clicked x into it. Always returns a usable column (0 when nothing can be measured).
 */
async function refineSynctexColumn(synctexBinary, artifacts, inputPath, lineNumber, clickX) {
  try {
    const spec = `${lineNumber}:0:${inputPath}`
    const run = await runChildProcess(synctexBinary, ['view', '-i', spec, '-o', artifacts.pdfPath], {
      cwd: artifacts.workDir,
      env: process.env,
      timeoutMs: 10000,
    })
    const stdout = String(run.stdout ?? '')
    const h = /^h:([-\d.]+)$/m.exec(stdout)
    const w = /^W:([-\d.]+)$/m.exec(stdout)
    if (h === null || w === null) return { column: 0, debug: { missing: 'box' } }
    const left = Number(h[1])
    const width = Number(w[1])
    if (!Number.isFinite(left) || !Number.isFinite(width) || width <= 0) {
      return { column: 0, debug: { missing: 'box-width', left, width } }
    }
    const lines = fs.readFileSync(inputPath, 'utf8').split('\n')
    const lineText = lines[lineNumber - 1]
    if (typeof lineText !== 'string') return { column: 0, debug: { missing: 'line' } }
    const fraction = (clickX - left) / width
    const offsets = typesetOffsets(lineText)
    return {
      column: columnFromFraction(lineText, fraction),
      debug: {
        left,
        width,
        fraction: Number(fraction.toFixed(4)),
        typeset: offsets.length,
        lineLength: lineText.length,
        boxes: (String(run.stdout ?? '').match(/^h:/gm) ?? []).length,
      },
    }
  } catch (error) {
    return { column: 0, debug: { missing: 'error', message: String(error?.message ?? error) } }
  }
}

function parseLogFailure(log, logTail) {
  const lineMatch = /^(.+?):(\d+): (.+)$/m.exec(log)
  if (lineMatch !== null) {
    const line = Number(lineMatch[2])
    return {
      line: Number.isFinite(line) ? line : undefined,
      message: lineMatch[3].trim(),
    }
  }
  for (const rawLine of String(logTail).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '') continue
    if (/^This is /.test(line)) continue
    if (/^Latexmk:/.test(line)) continue
    return { message: line }
  }
  return {}
}

function pdfPageCountFromLog(log) {
  const pattern = /(\d+)\s+pages?\b/gi
  let count
  let match
  while ((match = pattern.exec(log)) !== null) {
    const value = Number(match[1])
    if (Number.isFinite(value)) count = value
  }
  return count
}

/* --------------------------------------------------------------------------
 * Rasterize
 * ------------------------------------------------------------------------ */

function buildRasterArgs(pdfPath, outputPattern, settings) {
  return [
    '-q',
    '-dSAFER',
    '-dBATCH',
    '-dNOPAUSE',
    '-sDEVICE=png16m',
    `-r${settings.dpi}`,
    '-dTextAlphaBits=4',
    '-dGraphicsAlphaBits=4',
    '-dFirstPage=1',
    `-dLastPage=${settings.maxPages}`,
    `-sOutputFile=${outputPattern}`,
    pdfPath,
  ]
}

async function runRasterize({ pdf, settings, ghostscriptPath, env }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX))
  try {
    const pdfPath = path.join(tmp, 'document.pdf')
    fs.writeFileSync(pdfPath, pdf)
    const outputPattern = path.join(tmp, 'page-%04d.png')
    const run = await runChildProcess(
      ghostscriptPath,
      buildRasterArgs(pdfPath, outputPattern, settings),
      { cwd: tmp, env, timeoutMs: settings.timeoutMs },
    )

    if (run.timedOut) {
      return {
        failure: {
          code: 'timeout',
          message: `Ghostscript did not finish within ${settings.timeoutMs} ms and was stopped.`,
        },
      }
    }
    if (run.spawnError !== undefined) {
      if (run.spawnError?.code === 'ENOENT') {
        return {
          failure: {
            code: 'rasterizer-missing',
            message:
              'Ghostscript (gs) was not found, so the PDF pages cannot be rendered. Install Ghostscript, or set "ghostscriptPath" in the dsh-openprism-latex configuration.',
          },
        }
      }
      return {
        failure: {
          code: 'rasterize-failed',
          message: `Ghostscript could not be started: ${run.spawnError?.message ?? 'unknown error'}`,
          logTail: tailBytes(Buffer.from(run.stderr ?? ''), LOG_TAIL_BYTES),
        },
      }
    }

    let names = []
    try {
      names = fs.readdirSync(tmp)
    } catch {
      names = []
    }
    const pageFiles = []
    for (const name of names) {
      const match = /^page-(\d+)\.png$/i.exec(name)
      if (match !== null) pageFiles.push({ name, index: Number(match[1]) })
    }
    pageFiles.sort((a, b) => a.index - b.index)

    if (pageFiles.length === 0) {
      return {
        failure: {
          code: 'rasterize-failed',
          message: 'Ghostscript did not produce any page images.',
          logTail: tailBytes(Buffer.from(run.stderr ?? ''), LOG_TAIL_BYTES),
        },
      }
    }

    let totalBytes = 0
    const pages = []
    for (const file of pageFiles) {
      let bytes
      try {
        bytes = fs.readFileSync(path.join(tmp, file.name))
      } catch {
        return {
          failure: { code: 'rasterize-failed', message: 'A rendered page could not be read.' },
        }
      }
      totalBytes += bytes.length
      if (totalBytes > PNG_BUDGET) {
        return {
          failure: {
            code: 'too-large',
            message: 'The rendered pages exceed the 40 MiB preview limit.',
          },
        }
      }
      const size = pngDimensions(bytes)
      if (size === undefined) {
        return {
          failure: { code: 'rasterize-failed', message: 'Ghostscript produced an invalid PNG page.' },
        }
      }
      pages.push({ width: size.width, height: size.height, png: bytes.toString('base64') })
    }
    return { pages }
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {
      /* best effort */
    }
  }
}

function pngDimensions(bytes) {
  if (bytes.length < 24) return undefined
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return undefined
  if (bytes.toString('latin1', 12, 16) !== 'IHDR') return undefined
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  if (width === 0 || height === 0) return undefined
  return { width, height }
}

/* --------------------------------------------------------------------------
 * Child processes
 * ------------------------------------------------------------------------ */

function runChildProcess(command, args, options) {
  return new Promise(resolve => {
    let child
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
    } catch (error) {
      resolve({ spawnError: error, stdout: '', stderr: '', timedOut: false })
      return
    }

    const stdout = { chunks: [], size: 0 }
    const stderr = { chunks: [], size: 0 }
    const collect = (target, chunk) => {
      if (target.size >= OUTPUT_CAP || chunk === undefined || chunk === null) return
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      const remaining = OUTPUT_CAP - target.size
      if (remaining <= 0) return
      target.chunks.push(buffer.length > remaining ? buffer.subarray(0, remaining) : buffer)
      target.size += Math.min(buffer.length, remaining)
    }

    let settled = false
    let timedOut = false
    let killTimer
    const timer = setTimeout(() => {
      timedOut = true
      try {
        child.kill('SIGTERM')
      } catch {
        /* already gone */
      }
      killTimer = setTimeout(() => {
        try {
          child.kill('SIGKILL')
        } catch {
          /* already gone */
        }
      }, 2000)
      killTimer.unref?.()
    }, Math.max(1, options.timeoutMs))
    timer.unref?.()

    const finish = result => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (killTimer !== undefined) clearTimeout(killTimer)
      resolve({
        ...result,
        stdout: Buffer.concat(stdout.chunks).toString('utf8'),
        stderr: Buffer.concat(stderr.chunks).toString('utf8'),
        timedOut,
      })
    }

    child.stdout?.on('data', chunk => collect(stdout, chunk))
    child.stderr?.on('data', chunk => collect(stderr, chunk))
    child.on('error', error => finish({ spawnError: error }))
    child.on('close', (code, signal) => finish({ code, signal }))
  })
}

function tailBytes(bytes, limit) {
  if (!Buffer.isBuffer(bytes)) return ''
  if (bytes.length <= limit) return bytes.toString('utf8')
  return bytes.subarray(bytes.length - limit).toString('utf8')
}

/* --------------------------------------------------------------------------
 * Responses
 * ------------------------------------------------------------------------ */

function errorBody(code, message, extra = {}) {
  const error = { code, message }
  if (Number.isFinite(extra.line)) error.line = extra.line
  if (typeof extra.logTail === 'string' && extra.logTail !== '') error.logTail = extra.logTail
  if (typeof extra.currentVersion === 'string') error.currentVersion = extra.currentVersion
  return { ok: false, error }
}

function failureResponse(request, failure, mode) {
  const status =
    failure.status !== undefined
      ? failure.status
      : mode === 'render'
        ? 200
        : (PDF_FAILURE_STATUS[failure.code] ?? 500)
  return jsonResponse(request, errorBody(failure.code, failure.message, failure), status)
}

function jsonResponse(request, body, status) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  }
  const payload = request.method === 'HEAD' ? null : JSON.stringify(body)
  return new Response(payload, { status, headers })
}

function rawResponse(request, bytes, status, headers) {
  return new Response(request.method === 'HEAD' ? null : bytes, { status, headers })
}
