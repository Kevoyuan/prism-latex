window.__ModuleLoader__.load({
  id: 'dsh-openprism-latex',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState } = React

    /** Shown in the panel header: which client bundle the page actually loaded. */
    const CLIENT_BUILD = '0.1.0+latex-tab'
    const SESSION_RESOURCE_PREFIX = 'dsh-resource://file/session/'
    const FIXED_ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]
    const RENDER_URL = 'api/dsh-openprism-latex/render'
    const PAGES_INSET = 24
    const RETRYABLE_CODES = new Set([
      'latex-error', 'network', 'timeout', 'bad-response', 'rasterize-failed', 'internal', 'bad-address',
    ])
    /** Per-file zoom preference, so switching to Plain text and back keeps the scale. */
    const zoomMemory = new Map()
    const ZOOM_MEMORY_LIMIT = 32

    const en = {
      title: 'LaTeX document',
      compiling: 'Compiling LaTeX…',
      recompiling: 'Recompiling…',
      controls: 'Preview controls',
      errorTitle: 'This document could not be compiled',
      errorLatex: 'LaTeX reported an error.',
      errorRasterizeFailed: 'The compiled PDF could not be turned into page images.',
      errorInternal: 'The preview failed unexpectedly.',
      errorEngineMissing: 'No LaTeX engine was found. Install TeX Live, or set "enginePath" in the plugin configuration.',
      errorRasterizerMissing: 'Ghostscript (gs) was not found, so the pages cannot be rendered. Install Ghostscript and reopen the preview.',
      errorTimeout: 'Compiling took too long and was stopped.',
      errorTooLarge: 'The preview is too large to display.',
      errorNoWorkspace: 'This file is not inside a workspace, so it cannot be compiled.',
      errorNotFound: 'The file no longer exists.',
      errorForbidden: 'This file is outside the workspace and cannot be previewed.',
      errorBadRequest: 'This file cannot be previewed.',
      errorBadAddress: 'The preview address is not valid.',
      errorBadResponse: 'The preview response could not be read.',
      errorNetwork: 'The preview request failed.',
      errorNoPages: 'The compiled document has no pages.',
      errorUnexpected: 'The preview could not be prepared.',
      errorLine: 'Line {line}',
      logLabel: 'Compiler output',
      retry: 'Retry',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      fitWidth: 'Fit width',
      fit: 'Fit',
      download: 'Download PDF',
      downloadFailed: 'Download failed',
      downloadBusy: 'Preparing PDF…',
      pageAlt: 'Page {index}',
      pageMetaOne: '1 page · {seconds} s',
      pageMeta: '{count} pages · {seconds} s',
      truncated: 'First {count} pages',
      panelTitle: 'LaTeX',
      panelFileCount: '{count} documents',
      panelFileCountOne: '1 document',
      panelRefresh: 'Refresh',
      panelLoading: 'Looking for .tex files…',
      panelEmpty: 'No .tex files in this workspace.',
      panelEmptyHint: 'Ask the agent to write one, then refresh.',
      panelNoSession: 'Open a conversation to browse its workspace.',
      panelError: 'The workspace could not be read.',
      panelUnavailable: 'Workspace files are unavailable here.',
      panelPick: 'Pick a document above to compile it here.',
      panelIntro: 'Compiled with the local TeX Live. Pick a document to render it in this panel.',
      panelTypeMissing: 'The sidebar LaTeX tab type is not registered in this page.',
      viewMode: 'View mode',
      modePreview: 'Preview',
      modeSource: 'Source',
      modeSplit: 'Side by side',
      sourceLoading: 'Loading source…',
      sourceError: 'The source could not be read.',
      sourceTruncated: 'Source cut to the first {count} lines.',
      statusReady: '{pages} pages · {seconds} s',
      statusReadyOne: '1 page · {seconds} s',
      statusFailed: 'Compile failed',
      statusCached: '{pages} pages · cached',
      statusCachedOne: '1 page · cached',
      statusIdle: 'Not compiled',
      statusHint: 'Compile status',
      editorLabel: 'LaTeX source editor',
      save: 'Save',
      saveHint: 'Save (⌘S)',
      compile: 'Compile (⌘↩)',
      unsaved: 'Unsaved changes',
      conflict: 'Changed on disk',
      reload: 'Reload from disk',
      saveFailed: 'Save failed',
      readOnlyTooLarge: 'Too large to edit here; showing the file read-only.',
      copyError: 'Copy the error',
      sendToChat: 'Send the error to the chat',
      copied: 'Copied',
    }

    const ERROR_KEYS = {
      'engine-missing': 'errorEngineMissing',
      'rasterizer-missing': 'errorRasterizerMissing',
      'rasterize-failed': 'errorRasterizeFailed',
      internal: 'errorInternal',
      timeout: 'errorTimeout',
      'too-large': 'errorTooLarge',
      'no-workspace': 'errorNoWorkspace',
      'not-found': 'errorNotFound',
      forbidden: 'errorForbidden',
      'bad-request': 'errorBadRequest',
      'bad-address': 'errorBadAddress',
      'bad-response': 'errorBadResponse',
      network: 'errorNetwork',
      'no-pages': 'errorNoPages',
      'latex-error': 'errorLatex',
    }

    const CSS = `
.oprilx-root {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100%;
  overflow: auto;
  background: var(--dsw-alias-bg-document-preview, var(--dsw-alias-bg-layer-2, #f1f2f4));
  color: var(--dsw-alias-label-primary, #1c1c1e);
  font-family: var(--dsw-font, system-ui, -apple-system, sans-serif);
  font-size: var(--dsh-content-font-size, 14px);
}
.oprilx-center {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 160px;
  box-sizing: border-box;
  padding: 28px;
  text-align: center;
}
.oprilx-spinner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  border-top-color: var(--dsw-alias-label-secondary, #6b7280);
  animation: oprilx-spin .8s linear infinite;
}
@keyframes oprilx-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .oprilx-spinner { animation: none !important; }
}
.oprilx-status {
  color: var(--dsw-alias-label-secondary, #6b7280);
}
.oprilx-error {
  width: min(100%, 560px);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  box-sizing: border-box;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  background: var(--dsw-alias-bg-overlay, #fff);
  box-shadow: var(--dsw-elevation-prominent, 0 1px 3px rgba(0, 0, 0, .14), 0 8px 24px rgba(0, 0, 0, .10));
  text-align: left;
}
.oprilx-error-title {
  color: var(--dsw-alias-state-error-primary, #c0392b);
  font-weight: 600;
}
.oprilx-error-message {
  color: var(--dsw-alias-label-primary, #1c1c1e);
}
.oprilx-error-line,
.oprilx-error-detail {
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 13px;
}
.oprilx-log-block {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.oprilx-log-label {
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 12px;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.oprilx-log {
  margin: 0;
  width: 100%;
  max-height: 240px;
  overflow: auto;
  box-sizing: border-box;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  background: var(--dsw-alias-bg-document-preview, var(--dsw-alias-bg-layer-2, #f1f2f4));
  color: var(--dsw-alias-label-primary, #1c1c1e);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.oprilx-button {
  appearance: none;
  cursor: pointer;
  border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  background: var(--dsw-alias-bg-overlay, #fff);
  color: var(--dsw-alias-label-primary, #1c1c1e);
  padding: 6px 14px;
  font: inherit;
}
.oprilx-button:hover {
  border-color: var(--dsw-alias-label-secondary, #6b7280);
}
.oprilx-button:focus-visible,
.oprilx-pill-button:focus-visible,
.oprilx-log:focus-visible {
  outline: 2px solid var(--dsw-alias-label-primary, #1c1c1e);
  outline-offset: 2px;
}
.oprilx-pages {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
  box-sizing: border-box;
  /* Bottom room so the sticky control pill never hides the last lines of a page. */
  padding: 14px 14px 74px;
  animation: oprilx-enter .18s ease-out;
}
@keyframes oprilx-enter {
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .oprilx-pages { animation: none; }
}
.oprilx-page {
  margin: 0 auto;
  border-radius: 3px;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .10));
  box-shadow: 0 1px 2px rgba(0, 0, 0, .06), 0 10px 28px rgba(0, 0, 0, .08);
}
.oprilx-page-image {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  -webkit-user-drag: none;
}
.oprilx-pillwrap {
  position: sticky;
  bottom: 12px;
  z-index: 2;
  display: flex;
  justify-content: center;
  margin-top: -60px;
  padding: 0 12px 12px;
  pointer-events: none;
}
.oprilx-pill {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  gap: 3px;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: auto;
  padding: 4px 6px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  background: var(--dsw-alias-bg-overlay, #fff);
  color: var(--dsw-alias-label-primary, #1c1c1e);
  box-shadow: var(--dsw-elevation-prominent, 0 1px 3px rgba(0, 0, 0, .14), 0 8px 24px rgba(0, 0, 0, .10));
}
.oprilx-pill-button {
  appearance: none;
  cursor: pointer;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #1c1c1e);
  padding: 7px 9px;
  font: inherit;
  line-height: 1;
  white-space: nowrap;
}
.oprilx-pill-button:hover:enabled {
  background: var(--dsw-alias-bg-document-preview, var(--dsw-alias-bg-layer-2, #f1f2f4));
}
.oprilx-pill-button:disabled {
  cursor: default;
  opacity: .5;
  color: var(--dsw-alias-label-secondary, #6b7280);
}
.oprilx-pill-button[aria-pressed="true"] {
  background: var(--dsw-alias-bg-document-preview, var(--dsw-alias-bg-layer-2, #f1f2f4));
}
.oprilx-zoom-label {
  min-width: 44px;
  text-align: center;
  color: var(--dsw-alias-label-primary, #1c1c1e);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.oprilx-pill-divider {
  flex: 0 0 auto;
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
}
.oprilx-meta {
  padding: 0 6px;
  color: var(--dsw-alias-label-primary, #1c1c1e);
  font-size: 12px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.oprilx-glyph {
  display: block;
  flex: 0 0 auto;
}
.oprilx-tabactions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 2px;
}
.oprilx-save-button {
  appearance: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: var(--dsw-alias-brand-primary, #247bbf);
  color: #fff;
}
.oprilx-save-button:hover {
  filter: brightness(1.08);
}
.oprilx-save-button:focus-visible {
  outline: 2px solid var(--dsw-alias-label-primary, #1c1c1e);
  outline-offset: 1px;
}
.oprilx-error-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}
.oprilx-copied {
  color: var(--dsw-alias-state-success-primary, #2f9e63);
  font-size: 12px;
}
.oprilx-banner {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px 4px 12px;
  background: #3a3220;
  color: #e5c07b;
  font-size: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, .08);
}
.oprilx-banner .oprilx-icon-button {
  color: #e5c07b;
}
.oprilx-banner .oprilx-icon-button:hover {
  background: rgba(255, 255, 255, .08);
  color: #fff;
}
.oprilx-icon-button {
  appearance: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 7px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #6b7280);
}
.oprilx-icon-button:hover {
  background: var(--dsw-alias-bg-layer-2, #f1f2f4);
  color: var(--dsw-alias-label-primary, #1c1c1e);
}
.oprilx-icon-button:focus-visible {
  outline: 2px solid var(--dsw-alias-label-primary, #1c1c1e);
  outline-offset: 1px;
}
@container (max-width: 520px) {
  .oprilx-pill-meta {
    display: none;
  }
}
@container (max-width: 620px) {
  /* Keep the state dot, drop the sentence: the mode symbols and the save action matter
     more in a narrow pane. */
  .oprilx-tabstatus {
    display: none;
  }
}
@container (max-width: 430px) {
  .oprilx-pill-button[data-fit] {
    padding: 7px;
  }
}
.oprilx-note {
  padding: 0 6px;
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 12px;
  white-space: nowrap;
}
.oprilx-note[data-tone="error"] {
  color: var(--dsw-alias-state-error-primary, #c0392b);
}
.oprilx-tabroot {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  container-type: inline-size;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #1c1c1e);
  font-family: var(--dsw-font, system-ui, -apple-system, sans-serif);
  font-size: var(--dsh-content-font-size, 14px);
  -webkit-font-smoothing: antialiased;
}
.oprilx-toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 36px;
  box-sizing: border-box;
  padding: 5px 8px 5px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  background: var(--dsw-alias-bg-base, #fff);
}
.oprilx-tabmeta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}
.oprilx-tabstatus {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.oprilx-dot {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary, #9ca3af);
}
.oprilx-dot[data-state="ready"] {
  background: var(--dsw-alias-state-success-primary, #2f9e63);
}
.oprilx-dot[data-state="compiling"] {
  background: var(--dsw-alias-state-warn-primary, #c98a1b);
}
.oprilx-dot[data-state="error"] {
  background: var(--dsw-alias-state-error-primary, #c0392b);
}
.oprilx-modes {
  flex: 0 0 auto;
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2, #f1f2f4);
}
.oprilx-mode {
  appearance: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #6b7280);
  padding: 5px 9px;
  font: inherit;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  transition: color .12s ease, background-color .12s ease;
}
.oprilx-mode-icon {
  display: block;
  flex: 0 0 auto;
}
.oprilx-mode[aria-pressed="true"] .oprilx-mode-icon {
  opacity: 1;
}
.oprilx-mode:not([aria-pressed="true"]) .oprilx-mode-icon {
  opacity: .85;
}
.oprilx-mode:hover {
  color: var(--dsw-alias-label-primary, #1c1c1e);
}
.oprilx-mode[aria-pressed="true"] {
  background: var(--dsw-alias-bg-overlay, #fff);
  color: var(--dsw-alias-label-primary, #1c1c1e);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .10);
}
.oprilx-mode:focus-visible {
  outline: 2px solid var(--dsw-alias-label-primary, #1c1c1e);
  outline-offset: 1px;
}
@media (prefers-reduced-motion: reduce) {
  .oprilx-mode { transition: none; }
}
.oprilx-pane {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  container-type: inline-size;
}
.oprilx-pane[data-pane="preview"] {
  background: var(--dsw-alias-bg-document-preview, var(--dsw-alias-bg-layer-2, #f1f2f4));
}
/* One Dark, the palette open-prism's CodeMirror editor uses (Atom One Dark, MIT).
   The code surface is fixed dark in both host themes, like an inline editor island. */
.oprilx-pane[data-pane="source"] {
  background: #282c34;
  color: #abb2bf;
}
.oprilx-pane[data-pane="source"][data-editor="true"] {
  overflow: hidden;
}
.oprilx-editor {
  display: flex;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
}
.oprilx-zoombadge {
  padding: 0 6px;
  color: var(--opr-muted, #9aa0a6);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.oprilx-gutter {
  flex: 0 0 auto;
  width: 3.4em;
  padding: 10px 8px 16px 0;
  overflow: hidden;
  box-sizing: border-box;
  text-align: right;
  color: #5c6370;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--opr-code-size, 12px);
  line-height: 1.62;
  user-select: none;
  font-variant-numeric: tabular-nums;
}
.oprilx-editor-body {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}
.oprilx-code-highlight,
.oprilx-code-input {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  margin: 0;
  padding: 10px 14px 16px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--opr-code-size, 12px);
  line-height: 1.62;
  tab-size: 2;
  white-space: pre;
  overflow-wrap: normal;
  word-break: normal;
}
.oprilx-code-highlight {
  overflow: hidden;
  pointer-events: none;
  color: #abb2bf;
}
.oprilx-code-highlight[data-hidden="true"] {
  opacity: 0;
}
.oprilx-codeline {
  white-space: pre;
  min-height: 1.62em;
}
.oprilx-code-input {
  border: 0;
  outline: 0;
  resize: none;
  background: transparent;
  color: transparent;
  caret-color: #abb2bf;
  -webkit-text-fill-color: transparent;
  overflow: auto;
}
.oprilx-code-input[data-ime="true"] {
  color: #abb2bf;
  -webkit-text-fill-color: #abb2bf;
  background: #282c34;
}
.oprilx-code-input::selection {
  background: rgba(97, 175, 239, .28);
}
.oprilx-pane[data-pane="source"] .oprilx-status {
  color: #7d8799;
}
.oprilx-split {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}
.oprilx-split > .oprilx-pane {
  flex: 1 1 50%;
  min-width: 0;
}
.oprilx-split > .oprilx-pane + .oprilx-pane {
  border-left: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
}
.oprilx-progress {
  position: sticky;
  top: 0;
  z-index: 3;
  height: 2px;
  overflow: hidden;
  background: var(--dsw-alias-bg-layer-2, #e6e8eb);
}
.oprilx-progress::after {
  content: "";
  display: block;
  width: 38%;
  height: 100%;
  border-radius: 2px;
  background: var(--dsw-alias-brand-primary, #247bbf);
  animation: oprilx-sweep 1.15s ease-in-out infinite;
}
@keyframes oprilx-sweep {
  0% { transform: translateX(-40%); }
  100% { transform: translateX(280%); }
}
@media (prefers-reduced-motion: reduce) {
  .oprilx-progress::after { animation: none; width: 100%; opacity: .55; }
}
.oprilx-source {
  margin: 0;
  padding: 10px 14px 16px;
  color: #abb2bf;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.62;
  text-align: left;
  font-variant-ligatures: none;
  tab-size: 2;
}
.oprilx-srcline {
  display: flex;
  gap: 14px;
  white-space: pre;
}
.oprilx-srcline:hover {
  background: rgba(255, 255, 255, .045);
}
.oprilx-lineno {
  flex: 0 0 auto;
  width: 3em;
  text-align: right;
  color: #5c6370;
  user-select: none;
  font-variant-numeric: tabular-nums;
}
.oprilx-linetext {
  white-space: pre;
}
.oprilx-tok[data-type="comment"],
.oprilx-tok[data-type="cdata"] {
  color: #7d8799;
  font-style: italic;
}
.oprilx-tok[data-type="function"] {
  color: #61afef;
}
.oprilx-tok[data-type="keyword"] {
  color: #c678dd;
}
.oprilx-tok[data-type="headline"] {
  color: #e5c07b;
  font-weight: 600;
}
.oprilx-tok[data-type="equation"] {
  color: #56b6c2;
}
.oprilx-tok[data-type="equation-command"],
.oprilx-tok[data-type="regex"] {
  color: #56b6c2;
}
.oprilx-tok[data-type="url"] {
  color: #d19a66;
  text-decoration: underline dotted;
}
.oprilx-tok[data-type="punctuation"] {
  color: #abb2bf;
  opacity: .9;
}
.oprilx-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.oprilx-chip-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.oprilx-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #1c1c1e);
  font-family: var(--dsw-font, system-ui, -apple-system, sans-serif);
  font-size: var(--dsh-content-font-size, 14px);
}
.oprilx-panel-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 16px 10px;
}
.oprilx-panel-heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}
.oprilx-panel-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
}
.oprilx-panel-sub {
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 12px;
  line-height: 1.4;
}
.oprilx-panel-refresh {
  flex: 0 0 auto;
  appearance: none;
  cursor: pointer;
  border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  background: var(--dsw-alias-bg-layer-1, #fff);
  color: var(--dsw-alias-label-primary, #1c1c1e);
  padding: 5px 12px;
  font: inherit;
  font-size: 13px;
}
.oprilx-panel-refresh:hover {
  border-color: var(--dsw-alias-label-secondary, #6b7280);
}
.oprilx-panel-refresh:focus-visible {
  outline: 2px solid var(--dsw-alias-label-primary, #1c1c1e);
  outline-offset: 2px;
}
.oprilx-panel-list {
  flex: 0 0 auto;
  max-height: 32%;
  overflow: auto;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
}
.oprilx-panel-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 16px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary, #1c1c1e);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.oprilx-panel-row:hover {
  background: var(--dsw-alias-bg-layer-2, #f4f5f7);
}
.oprilx-panel-row:focus-visible {
  outline: 2px solid var(--dsw-alias-label-primary, #1c1c1e);
  outline-offset: -2px;
}
.oprilx-panel-row[aria-current="true"] {
  background: var(--dsw-alias-bg-layer-2, #f4f5f7);
  box-shadow: inset 2px 0 0 var(--dsw-alias-brand-primary, #247bbf);
}
.oprilx-panel-name {
  flex: 0 0 auto;
  font-weight: 500;
}
.oprilx-panel-path {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 12px;
  direction: rtl;
  text-align: left;
}
.oprilx-panel-note {
  padding: 12px 16px;
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 13px;
  line-height: 1.5;
}
.oprilx-panel-doc {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  background: var(--dsw-alias-bg-document-preview, var(--dsw-alias-bg-layer-2, #f1f2f4));
}

/* ---------------------------------------------------------------------------
 * Codex-Prism dark surface.
 * The pane owns its palette in both host themes: a near-black canvas, white
 * paper, and One Dark syntax hues. This mirrors the editor/preview look the
 * plugin is modelled on instead of borrowing the host's grey document surface.
 * ------------------------------------------------------------------------- */
.oprilx-tabroot,
.oprilx-root {
  --opr-bg: #0c0e0f;
  --opr-canvas: #0b0d0e;
  --opr-surface: #16181a;
  --opr-surface-2: #22262a;
  --opr-border: #24282c;
  --opr-text: #e6e8ea;
  --opr-muted: #9aa0a6;
  --opr-accent: #3f8efc;
  --opr-ready: #3fb950;
  --opr-warn: #d29922;
  --opr-danger: #f85149;
  background: var(--opr-bg);
  color: var(--opr-text);
}
.oprilx-toolbar {
  background: var(--opr-bg);
  border-bottom-color: var(--opr-border);
}
.oprilx-tabstatus {
  color: var(--opr-muted);
}
.oprilx-dot[data-state="ready"] { background: var(--opr-ready); }
.oprilx-dot[data-state="compiling"] { background: var(--opr-warn); }
.oprilx-dot[data-state="error"] { background: var(--opr-danger); }
.oprilx-dot[data-state="idle"] { background: #5c6370; }
.oprilx-modes {
  background: var(--opr-surface-2);
}
.oprilx-mode {
  color: var(--opr-muted);
}
.oprilx-mode:hover {
  color: var(--opr-text);
}
.oprilx-mode[aria-pressed="true"] {
  background: #34343c;
  color: #fff;
  box-shadow: none;
}
.oprilx-icon-button {
  color: var(--opr-muted);
}
.oprilx-icon-button:hover {
  background: var(--opr-surface-2);
  color: #fff;
}
.oprilx-icon-button:disabled {
  opacity: .45;
}
.oprilx-save-button {
  background: var(--opr-accent);
  color: #08080a;
}
.oprilx-save-button:hover {
  filter: brightness(1.1);
}
.oprilx-pane[data-pane="preview"] {
  background: var(--opr-canvas);
}
.oprilx-pane[data-pane="source"] {
  background: #0f1113;
}
.oprilx-page {
  background: #fff;
  border-color: #2b2b33;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .55), 0 14px 36px rgba(0, 0, 0, .55);
}
.oprilx-pill {
  background: #1a1a20;
  border-color: var(--opr-border);
  color: var(--opr-text);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .5);
}
.oprilx-pill-button {
  color: var(--opr-muted);
}
.oprilx-pill-button:hover:enabled {
  background: var(--opr-surface-2);
  color: #fff;
}
.oprilx-pill-button[aria-pressed="true"] {
  background: #34343c;
  color: #fff;
}
.oprilx-pill-button:disabled {
  color: #5c6370;
}
.oprilx-pill-divider {
  background: var(--opr-border);
}
.oprilx-zoom-label {
  color: var(--opr-text);
}
.oprilx-meta {
  color: var(--opr-text);
}
.oprilx-note {
  color: var(--opr-muted);
}
.oprilx-note[data-tone="error"] {
  color: var(--opr-danger);
}
.oprilx-status {
  color: var(--opr-muted);
}
.oprilx-spinner {
  border-color: #2a2a31;
  border-top-color: var(--opr-text);
}
.oprilx-error {
  background: #14141a;
  border-color: var(--opr-border);
  color: var(--opr-text);
  box-shadow: 0 12px 32px rgba(0, 0, 0, .55);
}
.oprilx-error-title {
  color: var(--opr-danger);
}
.oprilx-error-message {
  color: var(--opr-text);
}
.oprilx-error-line,
.oprilx-error-detail,
.oprilx-log-label {
  color: var(--opr-muted);
}
.oprilx-log {
  background: var(--opr-canvas);
  border-color: var(--opr-border);
  color: #d6d6da;
}
.oprilx-error-actions .oprilx-icon-button {
  color: var(--opr-muted);
}
.oprilx-copied {
  color: var(--opr-ready);
}
.oprilx-banner {
  background: #241d0e;
  border-bottom-color: var(--opr-border);
  color: #e5c07b;
}
.oprilx-gutter {
  background: #0f1113;
  color: #4b545e;
}
.oprilx-source {
  background: #0f1113;
  color: #e6e8ea;
}
/* Token classes follow codemirror-lang-latex, the grammar Open-Prism's editor uses:
   CtrlSeq → command, EnvName → environment, sectioning → section, Comment, Bracket,
   math → MathChar, optional arguments → option. Hues sampled from Codex's preview. */
.oprilx-tok[data-type="comment"],
.oprilx-tok[data-type="cdata"] {
  color: #6b7481;
  font-style: italic;
}
.oprilx-tok[data-type="command"] {
  color: #a892e8;
}
.oprilx-tok[data-type="section"] {
  color: #a892e8;
  font-weight: 600;
}
.oprilx-tok[data-type="environment"] {
  color: #e5c07b;
}
.oprilx-tok[data-type="option"] {
  color: #e0a575;
}
.oprilx-tok[data-type="math"] {
  color: #56b6c2;
}
.oprilx-tok[data-type="number"] {
  color: #d19a66;
}
.oprilx-tok[data-type="string"] {
  color: #98c379;
}
.oprilx-tok[data-type="bracket"] {
  color: #8b929a;
}
`

    let boundT = function fallbackTranslate(key) {
      return typeof en[key] === 'string' ? en[key] : key
    }

    function interpolate(template, values) {
      if (typeof template !== 'string') return ''
      return template.replace(/\{(\w+)\}/g, (match, name) => {
        const value = values[name]
        return value === undefined ? match : String(value)
      })
    }

    function tr(t, key, values = {}) {
      let template
      try {
        // Pass the values through as well: a locale service that interpolates
        // returns a finished string, and one that does not returns the template
        // that `interpolate` below fills in.
        template = typeof t === 'function' ? t(key, values) : undefined
      } catch {
        template = undefined
      }
      if (typeof template !== 'string' || template === key) template = en[key]
      return interpolate(template === undefined ? key : template, values)
    }

    function parseSessionAddress(address) {
      if (typeof address !== 'string') return undefined
      if (!address.startsWith(SESSION_RESOURCE_PREFIX)) return undefined
      const rest = address.slice(SESSION_RESOURCE_PREFIX.length)
      if (rest === '') return undefined
      const segments = rest.split('/')
      if (segments.length < 2) return undefined
      let sessionId
      const decoded = []
      try {
        sessionId = decodeURIComponent(segments[0])
        for (let index = 1; index < segments.length; index += 1) {
          decoded.push(decodeURIComponent(segments[index]))
        }
      } catch {
        return undefined
      }
      const filePath = decoded.join('/')
      if (sessionId === '' || filePath === '') return undefined
      return { sessionId, path: filePath }
    }

    function base64ToBytes(value) {
      const binary = atob(String(value === undefined ? '' : value))
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
      }
      return bytes
    }

    function rememberZoom(key, value) {
      if (typeof key !== 'string') return
      zoomMemory.delete(key)
      zoomMemory.set(key, value)
      while (zoomMemory.size > ZOOM_MEMORY_LIMIT) {
        const oldest = zoomMemory.keys().next()
        if (oldest.done === true) break
        zoomMemory.delete(oldest.value)
      }
    }

    function describeError(t, error) {
      const code = error !== null && typeof error === 'object' ? error.code : undefined
      const key = ERROR_KEYS[code]
      const message = key !== undefined
        ? tr(t, key)
        : typeof error?.message === 'string' && error.message !== ''
          ? error.message
          : tr(t, 'errorUnexpected')
      let detail = ''
      if (typeof error?.message === 'string' && error.message !== '' && key !== undefined) {
        // The Host's own sentence is the useful part when it classified the failure.
        detail = error.message
      }
      return {
        message,
        detail: detail === message ? '' : detail,
        retryable: error === null || typeof error !== 'object' ? true : RETRYABLE_CODES.has(error.code),
      }
    }

    function formatMeta(t, pageCount, durationMs) {
      const seconds = (Math.max(0, Number(durationMs) || 0) / 1000).toFixed(1)
      return tr(t, Number(pageCount) === 1 ? 'pageMetaOne' : 'pageMeta', { count: pageCount, seconds })
    }

    function pdfFilename(address) {
      const base = address !== undefined ? address.path.split('/').pop() : undefined
      const name = typeof base === 'string' && base !== '' ? base.replace(/\.[^./]+$/, '') : 'document'
      return `${name === '' ? 'document' : name}.pdf`
    }

    /** Scale at which a page is shown at 100%; pages never upscale past their intrinsic size. */
    function fitScaleFor(paneWidth, page) {
      if (page === undefined || typeof page.width !== 'number' || page.width <= 0) return 1
      if (typeof paneWidth !== 'number' || paneWidth <= 0) return 1
      const cssWidth = (page.width / (page.dpi > 0 ? page.dpi : 144)) * 96
      return Math.min(1, Math.max(0.1, (paneWidth - PAGES_INSET) / cssWidth))
    }

    /** The next fixed step above or below the current scale, or `undefined` at the range end. */
    function nextZoomStep(current, fitScale, direction) {
      const base = current === 'fit' ? fitScale : current
      if (direction > 0) {
        return FIXED_ZOOM_STEPS.find(step => step > base + 0.001)
      }
      const below = FIXED_ZOOM_STEPS.filter(step => step < base - 0.001)
      return below.length === 0 ? undefined : below[below.length - 1]
    }

    function pillButton(t, key, labelKey, symbol, onClick, disabled, extra = {}) {
      const label = tr(t, labelKey)
      return h('button', {
        type: 'button',
        key,
        className: 'oprilx-pill-button',
        'aria-label': label,
        title: label,
        onClick,
        disabled: disabled === true,
        ...extra,
      }, symbol)
    }

    function renderCompiling(t) {
      return h('div', { className: 'oprilx-center', role: 'status', key: 'compiling' }, [
        h('div', { className: 'oprilx-spinner', 'aria-hidden': 'true', key: 'spinner' }),
        h('div', { className: 'oprilx-status', key: 'label' }, tr(t, 'compiling')),
      ])
    }

    /**
     * The plain-text report for one compile failure: enough for a chat message or a
     * clipboard paste to be actionable without the surrounding UI.
     */
    function errorReport(path, error) {
      const name = typeof path === 'string' && path !== '' ? path : 'the LaTeX file'
      const line = error !== null && typeof error === 'object' && Number.isFinite(error.line)
        ? ` at line ${error.line}`
        : ''
      const message = typeof error?.message === 'string' && error.message !== ''
        ? error.message
        : ''
      const tail = typeof error?.logTail === 'string' ? error.logTail.trim() : ''
      const parts = [`The LaTeX preview failed to compile \`${name}\`${line}.`]
      if (message !== '') parts.push('', message)
      if (tail !== '') parts.push('', '```log', tail.slice(-4000), '```')
      return parts.join('\n')
    }

    function renderError(t, error, options) {
      const { message, detail, retryable } = describeError(t, error)
      const logTail = typeof error?.logTail === 'string' ? error.logTail.trim() : ''
      const line = error !== null && typeof error === 'object' && Number.isFinite(error.line)
        ? error.line
        : undefined
      const children = [
        h('div', { className: 'oprilx-error-title', key: 'title' }, tr(t, 'errorTitle')),
        h('div', { className: 'oprilx-error-message', key: 'message' }, message),
      ]
      if (line !== undefined) {
        children.push(h('div', { className: 'oprilx-error-line', key: 'line' }, tr(t, 'errorLine', { line })))
      }
      if (detail !== '') {
        children.push(h('div', { className: 'oprilx-error-detail', key: 'detail' }, detail))
      }
      if (logTail !== '') {
        children.push(h('div', { className: 'oprilx-log-block', key: 'log' }, [
          h('div', { className: 'oprilx-log-label', key: 'log-label' }, tr(t, 'logLabel')),
          h('pre', { className: 'oprilx-log', key: 'log-body', tabIndex: 0 }, logTail),
        ]))
      }
      const actions = []
      if (retryable) {
        actions.push(h('button', {
          type: 'button',
          className: 'oprilx-icon-button',
          key: 'retry',
          'aria-label': tr(t, 'retry'),
          title: tr(t, 'retry'),
          onClick: options?.onRetry,
        }, glyph('retry', 15)))
      }
      actions.push(h('button', {
        type: 'button',
        className: 'oprilx-icon-button',
        key: 'copy',
        'aria-label': tr(t, 'copyError'),
        title: tr(t, 'copyError'),
        onClick: options?.onCopy,
      }, glyph('copy', 15)))
      if (typeof options?.onSend === 'function') {
        actions.push(h('button', {
          type: 'button',
          className: 'oprilx-icon-button',
          key: 'send',
          'aria-label': tr(t, 'sendToChat'),
          title: tr(t, 'sendToChat'),
          onClick: options.onSend,
        }, glyph('send', 15)))
      }
      if (options?.copied === true) {
        actions.push(h('span', { className: 'oprilx-copied', key: 'copied', role: 'status' },
          tr(t, 'copied')))
      }
      children.push(h('div', { className: 'oprilx-error-actions', key: 'actions' }, actions))
      return h('div', { className: 'oprilx-center', key: 'error' },
        h('div', { className: 'oprilx-error', role: 'alert' }, children))
    }

    function renderReady(context) {
      const { t, address, state, zoom, setZoom, fitScale, download, onDownload } = context
      const dpi = Number.isFinite(state.dpi) && state.dpi > 0 ? state.dpi : 144
      const fit = zoom === 'fit'
      const pages = state.pages.map((page, index) => {
        const pixelWidth = Number(page.width) > 0 ? Number(page.width) : 1
        const pixelHeight = Number(page.height) > 0 ? Number(page.height) : 1
        const cssWidth = (pixelWidth / dpi) * 96
        const style = fit
          ? { width: '100%', maxWidth: `${Math.max(1, Math.round(cssWidth))}px` }
          : { width: `${Math.max(1, Math.round(cssWidth * zoom))}px` }
        return h('div', { className: 'oprilx-page', key: `page-${index}`, style }, h('img', {
          className: 'oprilx-page-image',
          src: page.url,
          width: pixelWidth,
          height: pixelHeight,
          alt: tr(t, 'pageAlt', { index: index + 1 }),
          loading: 'lazy',
          decoding: 'async',
          draggable: false,
        }))
      })

      const zoomIndex = fit ? -1 : FIXED_ZOOM_STEPS.indexOf(zoom)
      const stepDown = nextZoomStep(zoom, fitScale, -1)
      const stepUp = nextZoomStep(zoom, fitScale, 1)
      const zoomLabel = fit ? tr(t, 'fit') : `${Math.round(Number(zoom) * 100)}%`
      const pill = [
        pillButton(t, 'zoom-out', 'zoomOut', '−', () => {
          if (stepDown !== undefined) setZoom(stepDown)
        }, stepDown === undefined),
        h('span', { className: 'oprilx-zoom-label', key: 'zoom-label', 'aria-live': 'polite' }, zoomLabel),
        pillButton(t, 'zoom-in', 'zoomIn', '+', () => {
          if (stepUp !== undefined) setZoom(stepUp)
        }, stepUp === undefined),
        h('span', { className: 'oprilx-pill-divider', key: 'divider-1', 'aria-hidden': 'true' }),
        pillButton(t, 'fit-width', 'fitWidth', glyph('fit'), () => setZoom('fit'), false, {
          'data-fit': 'true',
          'aria-pressed': fit ? 'true' : 'false',
        }),
        h('span', { className: 'oprilx-pill-divider', key: 'divider-2', 'aria-hidden': 'true' }),
        h('span', { className: 'oprilx-meta oprilx-pill-meta', key: 'meta' },
          formatMeta(t, state.pageCount, state.durationMs)),
      ]
      if (state.truncated === true) {
        pill.push(h('span', { className: 'oprilx-note oprilx-pill-meta', key: 'truncated' },
          tr(t, 'truncated', { count: state.pageCount })))
      }
      if (state.refreshing === true) {
        pill.push(h('span', { className: 'oprilx-note oprilx-pill-meta', key: 'refreshing', role: 'status' },
          tr(t, 'recompiling')))
      }
      if (download.status === 'busy') {
        pill.push(h('span', { className: 'oprilx-note', key: 'download-busy', role: 'status' },
          tr(t, 'downloadBusy')))
      }
      if (download.status === 'failed') {
        pill.push(h('span', {
          className: 'oprilx-note',
          key: 'download-failed',
          role: 'status',
          'data-tone': 'error',
        }, tr(t, 'downloadFailed')))
      }
      pill.push(h('span', { className: 'oprilx-pill-divider', key: 'divider-3', 'aria-hidden': 'true' }))
      pill.push(h('button', {
        type: 'button',
        className: 'oprilx-pill-button',
        key: 'download',
        'aria-label': tr(t, 'download'),
        title: tr(t, 'download'),
        'aria-busy': download.status === 'busy',
        onClick: onDownload,
        disabled: state.pdfUrl === '' || download.status === 'busy',
      }, glyph('download')))

      return [
        h('div', { className: 'oprilx-pages', key: 'pages' }, pages),
        h('div', { className: 'oprilx-pillwrap', key: 'pillwrap' },
          h('div', { className: 'oprilx-pill', role: 'group', 'aria-label': tr(t, 'controls') }, pill)),
      ]
    }

    /** Above this size the tokenizer costs more than the tint is worth. */
    const HIGHLIGHT_LIMIT = 200 * 1024

    /** One-entry memo: the source pane re-renders on scroll, zoom and mode changes. */
    let highlightCache = { text: undefined, lines: undefined }

    /** Tokenize the whole document once; line-oriented runs for the gutter view. */
    function highlightLatexLines(text) {
      if (typeof text !== 'string' || text === '') return undefined
      if (highlightCache.text === text) return highlightCache.lines
      if (text.length > HIGHLIGHT_LIMIT) return undefined
      let lines
      try {
        lines = tokenizeLatex(text)
      } catch {
        lines = undefined
      }
      highlightCache = { text, lines }
      return lines
    }

    const SECTIONING = /^\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph|title|author|date|chapter\*)\b/

    function tokenizeLatex(text) {
      const lines = [[]]
      const push = (type, value) => {
        if (value === '') return
        const parts = value.split('\n')
        for (let index = 0; index < parts.length; index += 1) {
          if (index > 0) lines.push([])
          const part = parts[index]
          if (part !== '') lines[lines.length - 1].push({ type, text: part })
        }
      }
      let i = 0
      let math = undefined
      let dollars = ''
      while (i < text.length) {
        const ch = text[i]
        if (math === undefined) {
          if (ch === '$') {
            dollars = text.startsWith('$$', i) ? '$$' : '$'
            push('bracket', dollars)
            math = dollars
            i += dollars.length
            continue
          }
          if (text.startsWith('\\[', i)) { push('bracket', '\\['); math = '\\]'; i += 2; continue }
          if (text.startsWith('\\(', i)) { push('bracket', '\\('); math = '\\)'; i += 2; continue }
          if (text.startsWith('\\verb', i)) {
            const verb = /^\\verb\*?([^A-Za-z\s])/.exec(text.slice(i))
            if (verb !== null) {
              const bodyEnd = text.indexOf(verb[1], i + verb[0].length)
              const stop = bodyEnd === -1 ? text.length : bodyEnd + 1
              push('command', text.slice(i, i + verb[0].length - 1))
              push('string', text.slice(i + verb[0].length - 1, stop))
              i = stop
              continue
            }
          }
        } else if (text.startsWith(math, i)) {
          push('bracket', math)
          i += math.length
          math = undefined
          continue
        }
        if (ch === '%') {
          const newline = text.indexOf('\n', i)
          const stop = newline === -1 ? text.length : newline
          push('comment', text.slice(i, stop))
          i = stop
          continue
        }
        if (ch === '\\') {
          const command = /^\\([A-Za-z@]+\*?|.)/.exec(text.slice(i))
          const raw = command === null ? '\\' : command[0]
          const name = raw.slice(1)
          const inMath = math !== undefined
          if (inMath) push('math', raw)
          else push(SECTIONING.test(raw) ? 'section' : 'command', raw)
          i += raw.length
          if (!inMath && (name === 'begin' || name === 'end')) {
            if (text[i] === '{') {
              push('bracket', '{')
              i += 1
              const close = text.indexOf('}', i)
              const stop = close === -1 ? text.length : close
              push('environment', text.slice(i, stop))
              i = stop
              if (text[i] === '}') { push('bracket', '}'); i += 1 }
            }
            continue
          }
          if (!inMath && text[i] === '[') {
            const close = text.indexOf(']', i)
            const stop = close === -1 ? text.length : close + 1
            push('option', text.slice(i, stop))
            i = stop
            continue
          }
          continue
        }
        if (ch >= '0' && ch <= '9') {
          const number = /^[0-9]+(?:\.[0-9]+)?/.exec(text.slice(i))
          push('number', number[0])
          i += number[0].length
          continue
        }
        if (ch === '{' || ch === '}' || ch === '[' || ch === ']') {
          push('bracket', ch)
          i += 1
          continue
        }
        let j = i + 1
        while (j < text.length) {
          const next = text[j]
          if (next === '\\' || next === '$' || next === '%' || next === '{' || next === '}' || next === '[' || next === ']') break
          if (next >= '0' && next <= '9') break
          j += 1
        }
        push(math === undefined ? 'plain' : 'math', text.slice(i, j))
        i = j
      }
      return lines
    }

    /** Render one highlighted run list, falling back to the plain line text. */
    function sourceLineNodes(line, runs) {
      if (runs === undefined) return line === '' ? ' ' : line
      return runs.length === 1 && runs[0].type === 'plain'
        ? runs[0].text
        : runs.map((run, index) => (run.type === 'plain'
          ? run.text
          : h('span', { className: 'oprilx-tok', 'data-type': run.type, key: `r${index}` }, run.text)))
    }

    /** The toolbar's status line: a state tone plus its localized text. */
    function compileStatus(t, state) {
      if (state.status === 'ready') {
        const duration = Math.max(0, Number(state.durationMs) || 0)
        const pages = Number(state.pageCount) || (Array.isArray(state.pages) ? state.pages.length : 0)
        const tone = state.refreshing === true ? 'compiling' : 'ready'
        // A cached compile has no duration to report; saying "0.0 s" reads as broken.
        if (duration < 1) {
          return {
            tone,
            text: tr(t, pages === 1 ? 'statusCachedOne' : 'statusCached', { pages }),
          }
        }
        const seconds = (duration / 1000).toFixed(1)
        return { tone, text: tr(t, pages === 1 ? 'statusReadyOne' : 'statusReady', { pages, seconds }) }
      }
      if (state.status === 'compiling') return { tone: 'compiling', text: tr(t, 'compiling') }
      if (state.status === 'error') return { tone: 'error', text: tr(t, 'statusFailed') }
      return { tone: 'idle', text: tr(t, 'statusIdle') }
    }

    /** Stroke symbols shared by the controls: fit width, download, refresh, retry. */
    function glyph(name, size = 14) {
      const frame = {
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        'aria-hidden': 'true',
        className: 'oprilx-glyph',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.75,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }
      if (name === 'fit') {
        return h('svg', { ...frame, key: 'glyph' }, [
          h('path', { key: 'edges', d: 'M4 6.5v11M20 6.5v11' }),
          h('path', { key: 'arrow', d: 'M8 12h8M10.5 9.5 8 12l2.5 2.5M13.5 9.5 16 12l-2.5 2.5' }),
        ])
      }
      if (name === 'download') {
        return h('svg', { ...frame, key: 'glyph' }, [
          h('path', { key: 'arrow', d: 'M12 4v9.5M8.2 10.2 12 14l3.8-3.8' }),
          h('path', { key: 'tray', d: 'M4.8 16.6v1.6a1.6 1.6 0 0 0 1.6 1.6h11.2a1.6 1.6 0 0 0 1.6-1.6v-1.6' }),
        ])
      }
      if (name === 'play') {
        return h('svg', {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          'aria-hidden': 'true',
          className: 'oprilx-glyph',
        }, h('path', { key: 'play', d: 'M8.4 5.2 19 12 8.4 18.8z', fill: 'currentColor' }))
      }
      if (name === 'copy') {
        return h('svg', { ...frame, key: 'glyph' }, [
          h('rect', { key: 'back', x: 8.2, y: 3.8, width: 11, height: 12.4, rx: 2.2 }),
          h('path', { key: 'front', d: 'M15.4 19.4h-9a2 2 0 0 1-2-2v-9' }),
        ])
      }
      if (name === 'send') {
        return h('svg', { ...frame, key: 'glyph' }, [
          h('path', { key: 'plane', d: 'M20.4 3.6 3.6 10.4l6.6 2.9 2.9 6.6z' }),
          h('path', { key: 'fold', d: 'M10.2 13.3 20.4 3.6' }),
        ])
      }
      if (name === 'save') {
        return h('svg', { ...frame, key: 'glyph' }, [
          h('path', { key: 'body', d: 'M5.4 4.8h10.4l2.8 2.8v11.6H5.4z' }),
          h('path', { key: 'slot', d: 'M8.6 4.8v4.4h6.2V4.8' }),
          h('path', { key: 'label', d: 'M8.4 19.2v-5.1h7.2v5.1' }),
        ])
      }
      return h('svg', { ...frame, key: 'glyph' }, [
        h('path', { key: 'arc', d: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3' }),
        h('path', { key: 'head', d: 'M19.6 4.4v3.9h-3.9' }),
      ])
    }

    /** The symbol for one view mode: eye, code chevrons, split pane. */
    function modeIcon(value) {
      const frame = {
        viewBox: '0 0 24 24',
        width: 15,
        height: 15,
        'aria-hidden': 'true',
        className: 'oprilx-mode-icon',
      }
      if (value === 'preview') {
        return h('svg', { ...frame, key: 'icon' }, [
          h('path', {
            key: 'eye',
            d: 'M2.6 12s3.5-5.4 9.4-5.4S21.4 12 21.4 12s-3.5 5.4-9.4 5.4S2.6 12 2.6 12Z',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.7,
            strokeLinejoin: 'round',
          }),
          h('circle', {
            key: 'pupil',
            cx: 12,
            cy: 12,
            r: 2.5,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.7,
          }),
        ])
      }
      if (value === 'source') {
        return h('svg', { ...frame, key: 'icon' }, [
          h('path', {
            key: 'chevrons',
            d: 'M9.4 7.4 4.6 12l4.8 4.6M14.6 7.4 19.4 12l-4.8 4.6',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.8,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }),
        ])
      }
      return h('svg', { ...frame, key: 'icon' }, [
        h('rect', {
          key: 'frame',
          x: 3.6,
          y: 4.8,
          width: 16.8,
          height: 14.4,
          rx: 2.2,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
        }),
        h('path', {
          key: 'divider',
          d: 'M12 4.8v14.4',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
        }),
        h('path', {
          key: 'fill',
          d: 'M13.6 6.6h4.9v11.9h-4.9z',
          fill: 'currentColor',
          opacity: 0.16,
        }),
      ])
    }

    /** One mode button of the tab's Preview / Source / Side-by-side switch. */
    function modeButton(t, value, labelKey, mode, setMode) {
      const label = tr(t, labelKey)
      return h('button', {
        type: 'button',
        key: value,
        className: 'oprilx-mode',
        'aria-label': label,
        title: label,
        'aria-pressed': mode === value,
        onClick: () => setMode(value),
      }, modeIcon(value))
    }

    /**
     * The document-preview body: used when this composition offers `documentPreviews`
     * and the sidebar's own renderer menu is in play.
     */
    function LatexBody(props) {
      const t = typeof props.t === 'function' ? props.t : boundT
      const tabInfo = typeof props.useTabInfo === 'function' ? props.useTabInfo() : undefined
      const tabSignal = tabInfo?.tab?.signal
      const address = useMemo(() => parseSessionAddress(props.resourceAddress), [props.resourceAddress])
      const resource = typeof props.useResource === 'function'
        ? props.useResource(props.resourceAddress)
        : undefined
      const resourceRef = useRef(resource)
      resourceRef.current = resource
      const content = props.content
      const contentRef = useRef(content)
      contentRef.current = content

      const addressKey = address === undefined ? '' : `${address.sessionId}\u0000${address.path}`
      const [state, setState] = useState({ status: 'compiling' })
      const [zoom, setZoomState] = useState(() => (
        addressKey === '' ? 'fit' : (zoomMemory.get(addressKey) ?? 'fit')))
      const [download, setDownload] = useState({ status: 'idle' })
      const [paneWidth, setPaneWidth] = useState(0)
      const [copied, setCopied] = useState(false)
      const [codeFont, setCodeFont] = useState(() => readCodeFont())
      const [fontBadge, setFontBadge] = useState(undefined)

      const rootRef = useRef(null)
      /** Blob URLs currently shown; replaced generations are revoked after the commit. */
      const committedRef = useRef([])
      const revokeTimers = useRef([])
      const setZoom = value => {
        setZoomState(value)
        rememberZoom(addressKey, value)
      }

      const attachRoot = node => {
        rootRef.current = node
        if (typeof props.scrollportRef === 'function') props.scrollportRef(node)
      }

      useEffect(() => {
        const node = rootRef.current
        if (node === null || node === undefined) return undefined
        const measure = () => setPaneWidth(node.clientWidth)
        measure()
        if (typeof ResizeObserver === 'function') {
          const observer = new ResizeObserver(measure)
          observer.observe(node)
          return () => observer.disconnect()
        }
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
      }, [state.status])

      useEffect(() => () => {
        for (const timer of revokeTimers.current) clearTimeout(timer)
        revokeTimers.current = []
        for (const url of committedRef.current) {
          try {
            URL.revokeObjectURL(url)
          } catch {
            /* already revoked */
          }
        }
        committedRef.current = []
      }, [])

      useEffect(() => {
        const renderer = contentRef.current
        if (renderer === undefined || renderer === null || renderer.kind !== 'renderer') return undefined

        const target = parseSessionAddress(props.resourceAddress)
        if (target === undefined) {
          setState({ status: 'error', error: { code: 'bad-address' } })
          try {
            renderer.failed?.()
          } catch {
            /* the owner may already be gone */
          }
          return undefined
        }

        const controller = new AbortController()
        const signals = [controller.signal]
        if (tabSignal !== undefined) signals.push(tabSignal)
        let signal = controller.signal
        if (signals.length > 1) {
          signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function'
            ? AbortSignal.any(signals)
            : controller.signal
        }

        const versionAtStart = resourceRef.current?.value?.version
        let cancelled = false
        const created = []
        const timers = []
        const revoke = urls => {
          for (const url of urls) {
            try {
              URL.revokeObjectURL(url)
            } catch {
              /* already revoked */
            }
          }
        }
        const fail = error => {
          if (cancelled || signal.aborted) return
          revoke(created)
          setState({ status: 'error', error })
          try {
            renderer.failed?.()
          } catch {
            /* the owner may already be gone */
          }
        }

        setState(previous => (previous.status === 'ready'
          ? { ...previous, refreshing: true }
          : { status: 'compiling' }))

        const query = new URLSearchParams({ session: target.sessionId, path: target.path })
        fetch(`${RENDER_URL}?${query.toString()}`, { signal, cache: 'no-store' })
          .then(async response => {
            let body
            try {
              body = await response.json()
            } catch {
              body = undefined
            }
            if (cancelled || signal.aborted) return
            if (body === undefined) {
              fail({ code: 'bad-response', message: `HTTP ${response.status}` })
              return
            }
            if (body.ok !== true) {
              fail(body.error !== undefined && body.error !== null
                ? body.error
                : { code: 'bad-request', message: `HTTP ${response.status}` })
              return
            }
            const list = Array.isArray(body.pages) ? body.pages : []
            if (list.length === 0) {
              fail({ code: 'no-pages' })
              return
            }

            const pages = []
            for (const page of list) {
              let url
              try {
                const bytes = base64ToBytes(page?.png)
                url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
              } catch {
                fail({ code: 'bad-response' })
                return
              }
              created.push(url)
              pages.push({ url, width: Number(page?.width) || 0, height: Number(page?.height) || 0 })
            }
            if (cancelled || signal.aborted) return

            const stale = committedRef.current
            committedRef.current = pages.map(page => page.url)
            setState({
              status: 'ready',
              pages,
              pageCount: Number(body.pageCount) || pages.length,
              durationMs: Number(body.durationMs) || 0,
              dpi: Number(body.dpi) || 144,
              pdfUrl: typeof body.pdfUrl === 'string' ? body.pdfUrl : '',
              truncated: body.truncated === true,
            })
            if (stale.length > 0) {
              timers.push(setTimeout(() => revoke(stale), 0))
            }
            try {
              renderer.loaded?.(versionAtStart ?? body.version)
            } catch {
              /* the owner may already be gone */
            }
          })
          .catch(error => {
            if (cancelled || signal.aborted || error?.name === 'AbortError') return
            if (error !== null && typeof error === 'object' && typeof error.code === 'string') {
              fail(error)
              return
            }
            fail({ code: 'network', message: error?.message ? String(error.message) : undefined })
          })

        return () => {
          cancelled = true
          controller.abort()
          for (const timer of timers) clearTimeout(timer)
          revoke(created.filter(url => !committedRef.current.includes(url)))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [content?.revision, props.resourceAddress])

      if (content === undefined || content === null || content.kind !== 'renderer') {
        return null
      }

      const onDownload = () => {
        if (download.status === 'busy') return
        startDownload(state.status === 'ready' ? state.pdfUrl : '', pdfFilename(address), setDownload)
      }

      const copyError = () => copyText(errorReport(address?.path, state.error), setCopied)
      const sendError = () => sendToComposer(props.inputActions, errorReport(address?.path, state.error))

      const children = [h('style', { key: 'style' }, CSS)]
      if (state.status === 'compiling' || state.status === 'idle') {
        children.push(renderCompiling(t))
      } else if (state.status === 'error') {
        children.push(renderError(t, state.error, {
          onRetry: () => {
            try {
              contentRef.current?.reload?.()
            } catch {
              /* nothing else to do */
            }
          },
          onCopy: copyError,
          onSend: typeof props.inputActions === 'object' ? sendError : undefined,
          copied,
        }))
      } else if (state.status === 'ready') {
        children.push(...renderReady({
          t,
          address,
          state,
          zoom,
          setZoom,
          fitScale: fitScaleFor(paneWidth, { ...state.pages[0], dpi: state.dpi }),
          download,
          onDownload,
        }))
      }
      return h('div', { className: 'oprilx-root', ref: attachRoot }, children)
    }

    /**
     * The editable LaTeX source: a highlighted layer under a transparent textarea.
     *
     * CodeMirror is not available without a build step, so the editor keeps the Prism
     * token layer for color and a plain textarea for input, scroll-synced. While an IME
     * composition runs the real text is shown, because composed characters would
     * otherwise be invisible through the transparent textarea.
     */
    function SourceEditor(props) {
      const { t, text, resetToken, onInput, onSave, fontSize, onZoom } = props
      const [composing, setComposing] = useState(false)
      const areaRef = useRef(null)
      const codeRef = useRef(null)
      const gutterRef = useRef(null)
      const lines = text.split('\n')
      const highlighted = highlightLatexLines(text)

      // The textarea is uncontrolled on purpose: a controlled one loses the browser's
      // native undo stack (⌘Z) because React rewrites `value` on every keystroke. The
      // file text is adopted only when a new file version arrives.
      useEffect(() => {
        const area = areaRef.current
        if (area === null || area === undefined) return
        if (area.value !== text) area.value = text
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [resetToken])

      const sync = () => {
        const area = areaRef.current
        const code = codeRef.current
        const gutter = gutterRef.current
        if (area === null || area === undefined) return
        if (code !== null && code !== undefined) {
          code.scrollTop = area.scrollTop
          code.scrollLeft = area.scrollLeft
        }
        if (gutter !== null && gutter !== undefined) gutter.scrollTop = area.scrollTop
      }

      const handleKeyDown = event => {
        if ((event.metaKey || event.ctrlKey) && (event.key === 's' || event.key === 'S')) {
          event.preventDefault()
          onSave()
          return
        }
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          if (typeof props.onCompile === 'function') props.onCompile()
          return
        }
        if (event.metaKey || event.ctrlKey) {
          // Editor type size. preventDefault keeps the browser/Electron page zoom out of it.
          if (event.key === '=' || event.key === '+') {
            event.preventDefault()
            if (typeof onZoom === 'function') onZoom(1)
            return
          }
          if (event.key === '-' || event.key === '_') {
            event.preventDefault()
            if (typeof onZoom === 'function') onZoom(-1)
            return
          }
          if (event.key === '0') {
            event.preventDefault()
            if (typeof onZoom === 'function') onZoom(0)
            return
          }
        }
        if (event.key === 'Tab') {
          event.preventDefault()
          // execCommand participates in the native undo stack; a sliced assignment
          // would reset it.
          let inserted = false
          try {
            inserted = document.execCommand('insertText', false, '  ')
          } catch {
            inserted = false
          }
          if (!inserted) {
            const area = event.currentTarget
            const start = area.selectionStart
            const end = area.selectionEnd
            const next = `${area.value.slice(0, start)}  ${area.value.slice(end)}`
            area.value = next
            area.selectionStart = start + 2
            area.selectionEnd = start + 2
            onInput(next)
          }
        }
      }

      const size = Number.isFinite(fontSize) ? fontSize : CODE_FONT_DEFAULT
      return h('div', { className: 'oprilx-editor', style: { '--opr-code-size': `${size}px` } }, [
        h('div', { className: 'oprilx-gutter', key: 'gutter', ref: gutterRef, 'aria-hidden': 'true' },
          lines.map((_, index) => h('div', { key: index }, String(index + 1)))),
        h('div', { className: 'oprilx-editor-body', key: 'body' }, [
          h('pre', {
            className: 'oprilx-code-highlight',
            key: 'code',
            ref: codeRef,
            'aria-hidden': 'true',
            'data-hidden': composing ? 'true' : 'false',
          }, lines.map((line, index) => h('div', { className: 'oprilx-codeline', key: index },
            sourceLineNodes(line.length === 0 ? '' : line, highlighted?.[index])))),
          h('textarea', {
            className: 'oprilx-code-input',
            key: 'input',
            ref: areaRef,
            defaultValue: text,
            spellCheck: false,
            autoCapitalize: 'off',
            autoCorrect: 'off',
            wrap: 'off',
            'aria-label': tr(t, 'editorLabel'),
            'data-ime': composing ? 'true' : 'false',
            onChange: event => onInput(event.target.value),
            onScroll: sync,
            onKeyDown: handleKeyDown,
            onCompositionStart: () => setComposing(true),
            onCompositionEnd: event => {
              setComposing(false)
              onInput(event.currentTarget.value)
            },
          }),
        ]),
      ])
    }

    /** Tab chip text for one file address: its decoded basename. */
    function titleOfAddress(address) {
      if (typeof address !== 'string') return 'document.tex'
      const name = address.slice(address.lastIndexOf('/') + 1)
      if (name === '') return 'document.tex'
      try {
        return decodeURIComponent(name)
      } catch {
        return name
      }
    }

    /** Copy text to the clipboard, with an accessible confirmation flag. */
    function copyText(text, setCopied) {
      const done = () => {
        try {
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        } catch {
          /* nothing else to do */
        }
      }
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText !== undefined) {
          navigator.clipboard.writeText(text).then(done, () => {})
          return
        }
      } catch {
        /* fall through to the textarea path */
      }
      try {
        const scratch = document.createElement('textarea')
        scratch.value = text
        scratch.setAttribute('readonly', 'true')
        scratch.style.position = 'fixed'
        scratch.style.opacity = '0'
        document.body.appendChild(scratch)
        scratch.select()
        document.execCommand('copy')
        scratch.remove()
        done()
      } catch {
        /* clipboard unavailable */
      }
    }

    /** Insert the report into the session composer without replacing the user's draft. */
    function sendToComposer(actions, text) {
      if (actions === null || typeof actions !== 'object') return
      const report = `${text}\n`
      try {
        const span = typeof actions.captureInsertion === 'function' ? actions.captureInsertion() : undefined
        if (span !== undefined && typeof actions.insertText === 'function'
          && actions.insertText(report, span) === true) return
      } catch {
        /* fall through to setDraft */
      }
      // No setDraft fallback: replacing the draft would discard whatever the user had
      // typed. A refused insert leaves the composer untouched instead.
    }

    /** Download the compiled PDF of one file through the Host's pdf route. */
    function startDownload(pdfUrl, filename, setDownload) {
      if (typeof pdfUrl !== 'string' || pdfUrl === '') return
      setDownload({ status: 'busy' })
      fetch(pdfUrl, { cache: 'no-store' })
        .then(response => {
          if (response.ok !== true) throw new Error(`HTTP ${response.status}`)
          return response.blob()
        })
        .then(blob => {
          const url = URL.createObjectURL(blob)
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = filename
          anchor.rel = 'noopener'
          document.body.appendChild(anchor)
          anchor.click()
          anchor.remove()
          setTimeout(() => {
            try {
              URL.revokeObjectURL(url)
            } catch {
              /* already revoked */
            }
          }, 10000)
          setDownload({ status: 'idle' })
        })
        .catch(() => setDownload({ status: 'failed' }))
    }

    /** Sidebar icon: a prism splitting a beam, in the host's icon color. */
    function PanelIcon(props) {
      const size = Number.isFinite(props?.size) ? props.size : 18
      const active = props?.active === true
      return h('svg', {
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        'aria-hidden': 'true',
        style: { display: 'block', opacity: active ? 1 : 0.72 },
      }, [
        h('path', {
          key: 'beam', d: 'M3 17.2 10.4 12.6', stroke: 'currentColor', strokeWidth: 1.8,
          strokeLinecap: 'round', fill: 'none',
        }),
        h('path', {
          key: 'prism', d: 'M12 4.6 19 18.4H5Z', fill: 'none', stroke: 'currentColor',
          strokeWidth: 1.8, strokeLinejoin: 'round',
        }),
        h('path', {
          key: 'spectrum', d: 'M12.7 12.4 21 9.4M13.2 13.8 21 12M13.6 15.1 21 14.4',
          stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', fill: 'none', opacity: 0.85,
        }),
      ])
    }

    /** The client's own preference key for the session on screen. */
    const CURRENT_SESSION_KEY = 'dsh.sessions.current'
    /** Editor type size, remembered across files and reloads like an IDE. */
    const CODE_FONT_KEY = 'dsh-openprism-latex.font'
    const CODE_FONT_DEFAULT = 12
    const CODE_FONT_MIN = 10
    const CODE_FONT_MAX = 20

    /** @returns the remembered editor size, clamped to the supported range. */
    function readCodeFont() {
      try {
        const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(CODE_FONT_KEY)
        const parsed = Number.parseInt(String(raw), 10)
        if (!Number.isFinite(parsed)) return CODE_FONT_DEFAULT
        return Math.min(CODE_FONT_MAX, Math.max(CODE_FONT_MIN, parsed))
      } catch {
        return CODE_FONT_DEFAULT
      }
    }

    /** @param size - next editor size in px; stored clamped. */
    function rememberCodeFont(size) {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(CODE_FONT_KEY, String(size))
      } catch {
        /* preference storage is best effort */
      }
    }

    /** The session the app currently shows, read from that key. */
    function readCurrentSessionId() {
      try {
        const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(CURRENT_SESSION_KEY)
        if (typeof raw !== 'string' || raw === '') return undefined
        const parsed = JSON.parse(raw)
        const id = parsed?.sessionId
        return typeof id === 'string' && id !== '' ? id : undefined
      } catch {
        return undefined
      }
    }

    /**
     * The right sidebar tab body: one `.tex` file, with Preview / Source / Side-by-side.
     *
     * A tab type body (`kind: 'latex'`), so opening the file lands here directly: the
     * compile runs on the Host, the pages render in the pane, and the source comes from
     * this plugin's own `/source` route.
     */
    function LatexTab(props) {
      const t = typeof props.t === 'function' ? props.t : boundT
      const tabInfo = typeof props.useTabInfo === 'function' ? props.useTabInfo() : undefined
      const tab = tabInfo?.tab
      const address = typeof tab?.contentId === 'string' ? tab.contentId : undefined
      const target = useMemo(() => parseSessionAddress(address ?? ''), [address])
      const tabSignal = tab?.signal
      const [mode, setMode] = useState('preview')
      // The tab opens to compile immediately, so the toolbar reports work from frame one.
      const [state, setState] = useState({ status: 'compiling' })
      const [source, setSource] = useState({ status: 'idle' })
      const [attempt, setAttempt] = useState(0)
      const [zoom, setZoom] = useState('fit')
      const [download, setDownload] = useState({ status: 'idle' })
      const [paneWidth, setPaneWidth] = useState(0)
      const [draft, setDraft] = useState(undefined)
      const [save, setSave] = useState({ status: 'idle' })
      const [copied, setCopied] = useState(false)
      const [codeFont, setCodeFont] = useState(() => readCodeFont())
      const [fontBadge, setFontBadge] = useState(undefined)
      const rootRef = useRef(null)
      const urlsRef = useRef([])
      const draftRef = useRef(draft)
      draftRef.current = draft
      const sourceRef = useRef(source)
      sourceRef.current = source
      const savingRef = useRef(false)

      useEffect(() => {
        if (target === undefined) {
          setState({ status: 'error', error: { code: 'bad-address' } })
          return undefined
        }
        const controller = new AbortController()
        const signals = [controller.signal]
        if (tabSignal !== undefined) signals.push(tabSignal)
        let signal = controller.signal
        if (signals.length > 1) {
          signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function'
            ? AbortSignal.any(signals)
            : controller.signal
        }
        let cancelled = false
        const created = []
        const timers = []
        const revoke = urls => {
          for (const url of urls) {
            try {
              URL.revokeObjectURL(url)
            } catch {
              /* already revoked */
            }
          }
        }
        setState(previous => (previous.status === 'ready'
          ? { ...previous, refreshing: true }
          : { status: 'compiling' }))
        const query = new URLSearchParams({ session: target.sessionId, path: target.path })
        fetch(`${RENDER_URL}?${query.toString()}`, { signal, cache: 'no-store' })
          .then(async response => {
            let body
            try {
              body = await response.json()
            } catch {
              body = undefined
            }
            if (cancelled || signal.aborted) return
            if (body === undefined) {
              setState({ status: 'error', error: { code: 'bad-response', message: `HTTP ${response.status}` } })
              return
            }
            if (body.ok !== true) {
              setState({ status: 'error', error: body.error ?? { code: 'bad-request' } })
              return
            }
            const pages = []
            for (const page of Array.isArray(body.pages) ? body.pages : []) {
              let url
              try {
                url = URL.createObjectURL(new Blob([base64ToBytes(page?.png)], { type: 'image/png' }))
              } catch {
                setState({ status: 'error', error: { code: 'bad-response' } })
                return
              }
              created.push(url)
              pages.push({ url, width: Number(page?.width) || 0, height: Number(page?.height) || 0 })
            }
            if (pages.length === 0) {
              setState({ status: 'error', error: { code: 'no-pages' } })
              return
            }
            const stale = urlsRef.current
            urlsRef.current = pages.map(page => page.url)
            setState({
              status: 'ready',
              pages,
              pageCount: Number(body.pageCount) || pages.length,
              durationMs: Number(body.durationMs) || 0,
              dpi: Number(body.dpi) || 144,
              pdfUrl: typeof body.pdfUrl === 'string' ? body.pdfUrl : '',
              truncated: body.truncated === true,
            })
            if (stale.length > 0) timers.push(setTimeout(() => revoke(stale), 0))
          })
          .catch(error => {
            if (cancelled || signal.aborted || error?.name === 'AbortError') return
            setState({
              status: 'error',
              error: { code: 'network', message: error?.message ? String(error.message) : undefined },
            })
          })
        return () => {
          cancelled = true
          controller.abort()
          for (const timer of timers) clearTimeout(timer)
          revoke(created.filter(url => !urlsRef.current.includes(url)))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [target?.sessionId, target?.path, attempt])

      // Source is read on demand: Source and Side by side fetch it once per file.
      useEffect(() => {
        if (mode === 'preview' || target === undefined) return undefined
        if (source.status === 'ready' && source.path === target.path) return undefined
        const controller = new AbortController()
        let cancelled = false
        setSource({ status: 'loading', path: target.path })
        const query = new URLSearchParams({ session: target.sessionId, path: target.path })
        fetch(`api/dsh-openprism-latex/source?${query.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
          .then(async response => {
            let body
            try {
              body = await response.json()
            } catch {
              body = undefined
            }
            if (cancelled) return
            if (body === undefined || body.ok !== true) {
              setSource({
                status: 'error',
                path: target.path,
                message: body?.error?.message ? String(body.error.message) : `HTTP ${response.status}`,
              })
              return
            }
            setSource({
              status: 'ready',
              path: target.path,
              text: typeof body.text === 'string' ? body.text : '',
              truncated: body.truncated === true,
            })
          })
          .catch(error => {
            if (cancelled || error?.name === 'AbortError') return
            setSource({
              status: 'error',
              path: target.path,
              message: error?.message ? String(error.message) : undefined,
            })
          })
        return () => {
          cancelled = true
          controller.abort()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [mode, target?.sessionId, target?.path, source.status, source.path])

      useEffect(() => () => {
        for (const url of urlsRef.current) {
          try {
            URL.revokeObjectURL(url)
          } catch {
            /* already revoked */
          }
        }
        urlsRef.current = []
      }, [])

      useEffect(() => {
        const node = rootRef.current
        if (node === null || node === undefined) return undefined
        const measure = () => setPaneWidth(node.clientWidth)
        measure()
        if (typeof ResizeObserver === 'function') {
          const observer = new ResizeObserver(measure)
          observer.observe(node)
          return () => observer.disconnect()
        }
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
      }, [mode, state.status])

      const preview = []
      if (target === undefined) {
        preview.push(h('div', { className: 'oprilx-center', key: 'invalid' },
          h('div', { className: 'oprilx-status', role: 'alert' }, tr(t, 'errorBadAddress'))))
      } else if (state.status === 'compiling' || state.status === 'idle') {
        preview.push(renderCompiling(t))
      } else if (state.status === 'error') {
        preview.push(renderError(t, state.error, {
          onRetry: () => setAttempt(value => value + 1),
          onCopy: () => copyText(errorReport(target.path, state.error), setCopied),
          onSend: typeof props.inputActions === 'object'
            ? () => sendToComposer(props.inputActions, errorReport(target.path, state.error))
            : undefined,
          copied,
        }))
      } else {
        preview.push(...renderReady({
          t,
          address: target,
          state,
          zoom,
          setZoom,
          fitScale: fitScaleFor(paneWidth, { ...state.pages[0], dpi: state.dpi }),
          download,
          onDownload: () => startDownload(state.pdfUrl, pdfFilename(target), setDownload),
        }))
      }

      const editedText = draft !== undefined ? draft : (source.status === 'ready' ? source.text : '')
      const dirty = draft !== undefined && draft !== source.text

      const saveText = () => {
        const text = draftRef.current
        const current = sourceRef.current
        if (text === undefined || current.status !== 'ready' || savingRef.current) return
        if (target === undefined) return
        savingRef.current = true
        setSave({ status: 'saving' })
        fetch('api/dsh-openprism-latex/write', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            session: target.sessionId,
            path: target.path,
            text,
            expectedVersion: current.version,
          }),
        })
          .then(async response => {
            let body
            try {
              body = await response.json()
            } catch {
              body = undefined
            }
            return { response, body }
          })
          .then(({ response, body }) => {
            if (body?.ok === true) {
              setSource(previous => (previous.status === 'ready'
                ? { ...previous, text, version: String(body.version ?? ''), truncated: false }
                : previous))
              setDraft(undefined)
              setSave({ status: 'idle' })
              // Saving compiles, exactly like an IDE's save-then-preview loop.
              setAttempt(value => value + 1)
            } else if (response.status === 409) {
              setSave({ status: 'conflict' })
            } else {
              setSave({
                status: 'error',
                message: body?.error?.message ? String(body.error.message) : `HTTP ${response.status}`,
              })
            }
          })
          .catch(error => {
            setSave({ status: 'error', message: error?.message ? String(error.message) : undefined })
          })
          .finally(() => {
            savingRef.current = false
          })
      }

      const reloadSource = () => {
        setDraft(undefined)
        setSave({ status: 'idle' })
        setSource({ status: 'idle' })
      }

      const changeCodeFont = delta => {
        const next = delta === 0
          ? CODE_FONT_DEFAULT
          : Math.min(CODE_FONT_MAX, Math.max(CODE_FONT_MIN, codeFont + delta))
        if (next === codeFont) return
        setCodeFont(next)
        rememberCodeFont(next)
        setFontBadge(`${next}px`)
        setTimeout(() => setFontBadge(undefined), 1200)
      }

      const compileNow = () => {
        if (draftRef.current !== undefined) saveText()
        else setAttempt(value => value + 1)
      }

      const sourceChildren = []
      if (save.status === 'conflict' || save.status === 'error') {
        sourceChildren.push(h('div', {
          className: 'oprilx-banner',
          key: 'banner',
          role: 'alert',
        }, [
          h('span', { key: 'label' }, save.status === 'conflict'
            ? tr(t, 'conflict')
            : `${tr(t, 'saveFailed')}${save.message ? ` · ${save.message}` : ''}`),
          save.status === 'conflict'
            ? h('button', {
              type: 'button',
              className: 'oprilx-icon-button',
              key: 'reload',
              'aria-label': tr(t, 'reload'),
              title: tr(t, 'reload'),
              onClick: reloadSource,
            }, glyph('refresh', 15))
            : null,
        ]))
      }
      if (source.status === 'idle' || source.status === 'loading') {
        sourceChildren.push(h('div', { className: 'oprilx-center', key: 'source-loading', role: 'status' },
          h('div', { className: 'oprilx-status' }, tr(t, 'sourceLoading'))))
      } else if (source.status === 'error') {
        sourceChildren.push(h('div', { className: 'oprilx-center', key: 'source-error' },
          h('div', { className: 'oprilx-status', role: 'alert' },
            `${tr(t, 'sourceError')}${source.message ? ` · ${source.message}` : ''}`)))
      } else if (source.truncated === true) {
        const lines = source.text.split('\n')
        const highlighted = highlightLatexLines(source.text)
        sourceChildren.push(h('div', { className: 'oprilx-source', key: 'source-readonly' },
          lines.map((line, index) => h('div', { className: 'oprilx-srcline', key: index }, [
            h('span', { className: 'oprilx-lineno', key: 'n', 'aria-hidden': 'true' }, String(index + 1)),
            h('span', { className: 'oprilx-linetext', key: 't' },
              sourceLineNodes(line, highlighted?.[index])),
          ]))))
        sourceChildren.push(h('div', { className: 'oprilx-panel-note', key: 'source-cut' },
          tr(t, 'readOnlyTooLarge')))
      } else {
        sourceChildren.push(h(SourceEditor, {
          key: 'editor',
          t,
          text: editedText,
          resetToken: source.version,
          onInput: value => setDraft(value),
          onSave: saveText,
          onCompile: compileNow,
          fontSize: codeFont,
          onZoom: changeCodeFont,
        }))
      }

      const previewPane = h('div', {
        className: 'oprilx-pane',
        key: 'preview',
        'data-pane': 'preview',
        ref: node => { rootRef.current = node },
      }, state.refreshing === true
        ? [h('div', {
          className: 'oprilx-progress',
          key: 'progress',
          role: 'progressbar',
          'aria-label': tr(t, 'compiling'),
        }), ...preview]
        : preview)
      const sourcePane = h('div', {
        className: 'oprilx-pane',
        key: 'source',
        'data-pane': 'source',
        'data-editor': source.status === 'ready' && source.truncated !== true ? 'true' : 'false',
      }, sourceChildren)

      let body
      if (mode === 'preview') body = previewPane
      else if (mode === 'source') body = sourcePane
      else body = h('div', { className: 'oprilx-split', key: 'split' }, [sourcePane, previewPane])

      const status = compileStatus(t, state)
      const heading = typeof tab?.title === 'string' && tab.title !== ''
        ? tab.title
        : titleOfAddress(address)

      return h('div', { className: 'oprilx-tabroot' }, [
        h('style', { key: 'style' }, CSS),
        h('div', { className: 'oprilx-toolbar', key: 'toolbar' }, [
          h('div', { className: 'oprilx-tabmeta', key: 'meta' }, [
            h('span', {
              className: 'oprilx-dot',
              key: 'dot',
              'data-state': status.tone,
              'aria-hidden': 'true',
              title: tr(t, 'statusHint'),
            }),
            h('span', {
              className: 'oprilx-tabstatus',
              key: 'status',
              role: 'status',
              'aria-live': 'polite',
              title: heading,
            }, status.text),
          ]),
          h('div', { className: 'oprilx-tabactions', key: 'actions' }, [
            fontBadge === undefined
              ? null
              : h('span', { className: 'oprilx-zoombadge', key: 'font', role: 'status' }, fontBadge),
            dirty
              ? h('button', {
                type: 'button',
                className: 'oprilx-save-button',
                key: 'save',
                'aria-label': tr(t, 'saveHint'),
                title: tr(t, 'saveHint'),
                onClick: saveText,
              }, glyph('save', 14))
              : null,
            h('button', {
              type: 'button',
              className: 'oprilx-icon-button',
              key: 'compile',
              'aria-label': tr(t, 'compile'),
              title: tr(t, 'compile'),
              onClick: compileNow,
              disabled: save.status === 'saving',
            }, glyph('play', 15)),
          ]),
          h('div', {
            className: 'oprilx-modes',
            key: 'modes',
            role: 'group',
            'aria-label': tr(t, 'viewMode'),
          }, [
            modeButton(t, 'preview', 'modePreview', mode, setMode),
            modeButton(t, 'source', 'modeSource', mode, setMode),
            modeButton(t, 'split', 'modeSplit', mode, setMode),
          ]),
        ]),
        body,
      ])
    }

    /**
     * The LaTeX workspace panel: every `.tex` file of the current session's workspace,
     * compiled in place. This is the discoverable entry the renderer alone lacks.
     */
    function LatexPanel(props) {
      const t = typeof props.t === 'function' ? props.t : boundT
      const [tick, setTick] = useState(0)
      const [refresh, setRefresh] = useState(0)
      const [attempt, setAttempt] = useState(0)
      const [listing, setListing] = useState(() => (
        readCurrentSessionId() === undefined ? { status: 'no-session' } : { status: 'idle' }))
      const [selected, setSelected] = useState(undefined)
      const [renderState, setRenderState] = useState({ status: 'idle' })
      const [zoom, setZoom] = useState('fit')
      const [download, setDownload] = useState({ status: 'idle' })
      const [paneWidth, setPaneWidth] = useState(0)
      const [copied, setCopied] = useState(false)
      const [codeFont, setCodeFont] = useState(() => readCodeFont())
      const [fontBadge, setFontBadge] = useState(undefined)
      const docRef = useRef(null)
      const urlsRef = useRef([])
      const timersRef = useRef([])
      const sessionId = readCurrentSessionId()

      // The app keeps the current session in its own preference key; re-render on a
      // quiet timer so switching sessions updates the list without an event to bind.
      useEffect(() => {
        const timer = setInterval(() => setTick(value => value + 1), 2000)
        return () => clearInterval(timer)
      }, [])

      useEffect(() => {
        if (sessionId === undefined) {
          setListing({ status: 'no-session' })
          return undefined
        }
        const controller = new AbortController()
        let cancelled = false
        setListing({ status: 'loading' })
        Promise.resolve()
          .then(() => props.loader.searchTex(sessionId, controller.signal))
          .then(files => {
            if (cancelled) return
            setListing({ status: 'ready', files })
            setSelected(previous => (previous !== undefined && files.includes(previous)
              ? previous
              : files.length > 0 ? files[0] : undefined))
          })
          .catch(error => {
            if (cancelled || error?.name === 'AbortError') return
            setListing({ status: 'error', message: error instanceof Error ? error.message : '' })
          })
        return () => {
          cancelled = true
          controller.abort()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [sessionId, refresh])

      useEffect(() => {
        if (sessionId === undefined || selected === undefined) {
          setRenderState({ status: 'idle' })
          return undefined
        }
        const controller = new AbortController()
        const timers = timersRef.current
        let cancelled = false
        const created = []
        const revoke = urls => {
          for (const url of urls) {
            try {
              URL.revokeObjectURL(url)
            } catch {
              /* already revoked */
            }
          }
        }
        setRenderState({ status: 'compiling' })
        const query = new URLSearchParams({ session: sessionId, path: selected })
        fetch(`${RENDER_URL}?${query.toString()}`, { signal: controller.signal, cache: 'no-store' })
          .then(async response => {
            let body
            try {
              body = await response.json()
            } catch {
              body = undefined
            }
            if (cancelled) return
            if (body === undefined) {
              setRenderState({ status: 'error', error: { code: 'bad-response', message: `HTTP ${response.status}` } })
              return
            }
            if (body.ok !== true) {
              setRenderState({ status: 'error', error: body.error ?? { code: 'bad-request' } })
              return
            }
            const pages = []
            for (const page of Array.isArray(body.pages) ? body.pages : []) {
              let url
              try {
                url = URL.createObjectURL(new Blob([base64ToBytes(page?.png)], { type: 'image/png' }))
              } catch {
                setRenderState({ status: 'error', error: { code: 'bad-response' } })
                return
              }
              created.push(url)
              pages.push({ url, width: Number(page?.width) || 0, height: Number(page?.height) || 0 })
            }
            if (pages.length === 0) {
              setRenderState({ status: 'error', error: { code: 'no-pages' } })
              return
            }
            const stale = urlsRef.current
            urlsRef.current = pages.map(page => page.url)
            setRenderState({
              status: 'ready',
              pages,
              pageCount: Number(body.pageCount) || pages.length,
              durationMs: Number(body.durationMs) || 0,
              dpi: Number(body.dpi) || 144,
              pdfUrl: typeof body.pdfUrl === 'string' ? body.pdfUrl : '',
              truncated: body.truncated === true,
            })
            if (stale.length > 0) timers.push(setTimeout(() => revoke(stale), 0))
          })
          .catch(error => {
            if (cancelled || error?.name === 'AbortError') return
            setRenderState({
              status: 'error',
              error: { code: 'network', message: error?.message ? String(error.message) : undefined },
            })
          })
        return () => {
          cancelled = true
          controller.abort()
          for (const timer of timers) clearTimeout(timer)
          timers.length = 0
          revoke(created.filter(url => !urlsRef.current.includes(url)))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [sessionId, selected, attempt])

      useEffect(() => () => {
        for (const timer of timersRef.current) clearTimeout(timer)
        for (const url of urlsRef.current) {
          try {
            URL.revokeObjectURL(url)
          } catch {
            /* already revoked */
          }
        }
        urlsRef.current = []
      }, [])

      useEffect(() => {
        const node = docRef.current
        if (node === null || node === undefined) return undefined
        const measure = () => setPaneWidth(node.clientWidth)
        measure()
        if (typeof ResizeObserver === 'function') {
          const observer = new ResizeObserver(measure)
          observer.observe(node)
          return () => observer.disconnect()
        }
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
      }, [])

      const typeReady = typeof props.loader?.typeReady === 'function' ? props.loader.typeReady() : undefined
      const files = listing.status === 'ready' ? listing.files : []
      const heading = listing.status === 'ready'
        ? tr(t, files.length === 1 ? 'panelFileCountOne' : 'panelFileCount', { count: files.length })
        : listing.status === 'no-session'
          ? tr(t, 'panelNoSession')
          : listing.status === 'error'
            ? tr(t, 'panelError')
            : tr(t, 'panelLoading')

      const rows = []
      if (listing.status === 'ready') {
        if (files.length === 0) {
          rows.push(h('div', { className: 'oprilx-panel-note', key: 'empty' }, [
            h('div', { key: 'empty-line' }, tr(t, 'panelEmpty')),
            h('div', { key: 'empty-hint' }, tr(t, 'panelEmptyHint')),
          ]))
        }
        for (const file of files) {
          const parts = file.split('/')
          const name = parts[parts.length - 1]
          const directory = parts.slice(0, -1).join('/')
          rows.push(h('button', {
            type: 'button',
            key: file,
            className: 'oprilx-panel-row',
            'aria-current': selected === file ? 'true' : undefined,
            title: file,
            onClick: () => setSelected(file),
          }, [
            h('span', { className: 'oprilx-panel-name', key: 'name' }, name),
            directory === '' ? null : h('span', { className: 'oprilx-panel-path', key: 'path' }, directory),
          ]))
        }
      } else if (listing.status === 'error') {
        rows.push(h('div', {
          className: 'oprilx-panel-note', key: 'error', role: 'alert',
        }, listing.message === '' ? tr(t, 'panelError') : listing.message))
      } else if (listing.status === 'no-session') {
        rows.push(h('div', { className: 'oprilx-panel-note', key: 'session' }, tr(t, 'panelNoSession')))
      } else {
        rows.push(h('div', { className: 'oprilx-panel-note', key: 'loading', role: 'status' },
          tr(t, 'panelLoading')))
      }

      const doc = []
      if (renderState.status === 'compiling') {
        doc.push(renderCompiling(t))
      } else if (renderState.status === 'error') {
        doc.push(renderError(t, renderState.error, {
          onRetry: () => setAttempt(value => value + 1),
          onCopy: () => copyText(errorReport(selected, renderState.error), setCopied),
          copied,
        }))
      } else if (renderState.status === 'ready') {
        doc.push(...renderReady({
          t,
          address: selected === undefined ? undefined : { sessionId, path: selected },
          state: renderState,
          zoom,
          setZoom,
          fitScale: fitScaleFor(paneWidth, { ...renderState.pages[0], dpi: renderState.dpi }),
          download,
          onDownload: () => startDownload(renderState.pdfUrl, pdfFilename({ path: selected }), setDownload),
        }))
      } else {
        doc.push(h('div', { className: 'oprilx-panel-note', key: 'intro' }, [
          h('div', { key: 'intro-line' }, tr(t, 'panelIntro')),
          selected === undefined ? null : h('div', { key: 'pick-line' }, tr(t, 'panelPick')),
        ]))
      }

      return h('div', { className: 'oprilx-panel' }, [
        h('style', { key: 'style' }, CSS),
        h('div', { className: 'oprilx-panel-head', key: 'head' }, [
          h('div', { className: 'oprilx-panel-heading', key: 'heading' }, [
            h('div', { className: 'oprilx-panel-title', key: 'title' }, tr(t, 'panelTitle')),
            h('div', { className: 'oprilx-panel-sub', key: 'sub' }, `${heading}  ·  ${CLIENT_BUILD}`),
          ]),
          h('button', {
            type: 'button',
            className: 'oprilx-icon-button',
            key: 'refresh',
            'aria-label': tr(t, 'panelRefresh'),
            title: tr(t, 'panelRefresh'),
            onClick: () => setRefresh(value => value + 1),
          }, glyph('refresh', 15)),
        ]),
        typeReady === false
          ? h('div', {
            className: 'oprilx-panel-note',
            key: 'type-missing',
            role: 'alert',
            style: { color: 'var(--dsw-alias-state-error-primary, #c0392b)' },
          }, tr(t, 'panelTypeMissing'))
          : null,
        h('div', { className: 'oprilx-panel-list', key: 'list', role: 'list' }, rows),
        h('div', { className: 'oprilx-panel-doc', key: 'doc', ref: node => { docRef.current = node } }, doc),
      ])
    }

    function apply(ctx) {
      // English-only copy: this pane is an IDE-style tool, and the words are kept
      // deliberately terse. The locale chain falls back to `en` for every language.
      ctx.effect(() => ctx.locale.register('openprismLatex', { en }))
      const t = ctx.locale.bind('openprismLatex')
      boundT = t

      const definition = {
        id: 'dsh-openprism-latex',
        extensions: ['tex', 'latex', 'ltx'],
        priority: 'extension',
        title: () => t('title'),
        loading: 'renderer',
        wrap: false,
      }

      // The built-in sidebar preview provides `documentPreviews` while its own plugin
      // activates. When this bundle activates first the service is simply absent, and
      // `ctx.inject` did not wake for it in practice, so resolve it directly and keep
      // looking for a short while — the registry also has to be the live instance, not
      // one replaced by a later activation.
      let disposeDefinition
      let registeredOn
      let pollTimer
      const registryOf = () => {
        try {
          if (ctx.documentPreviews !== undefined && ctx.documentPreviews !== null) return ctx.documentPreviews
          if (typeof ctx.get === 'function') return ctx.get('documentPreviews')
        } catch {
          /* the service may be mid-registration */
        }
        return undefined
      }
      const registerDefinition = () => {
        const registry = registryOf()
        if (registry === undefined || typeof registry.register !== 'function') return false
        if (registeredOn === registry) return true
        registeredOn = registry
        disposeDefinition = registry.register(definition)
        if (pollTimer !== undefined) {
          clearInterval(pollTimer)
          pollTimer = undefined
        }
        return true
      }
      if (!registerDefinition()) {
        pollTimer = setInterval(registerDefinition, 150)
        const giveUp = setTimeout(() => {
          if (pollTimer !== undefined) {
            clearInterval(pollTimer)
            pollTimer = undefined
          }
        }, 20000)
        ctx.effect(() => () => {
          clearTimeout(giveUp)
          if (pollTimer !== undefined) clearInterval(pollTimer)
          if (typeof disposeDefinition === 'function') disposeDefinition()
        })
      } else {
        ctx.effect(() => () => {
          if (typeof disposeDefinition === 'function') disposeDefinition()
        })
      }

      ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
        name: 'sidebar.right.tab.document',
        key: 'dsh-openprism-latex',
        locale: 'openprismLatex',
      }, LatexBody)))

      // The right sidebar: a tab type of our own claims every LaTeX document, so the
      // pane renders the compiled file the moment it is opened. This is the primary
      // surface — the document-preview renderer above is a fallback for compositions
      // whose preview package offers the registry.
      let tabTypeState = 'unknown'
      let tabTypeError = ''
      let disposeTabType
      try {
        disposeTabType = ctx.sidebarRightTabs.register({
          id: 'dsh-openprism-latex',
          kind: 'latex',
          // Whole-address patterns: a plain `*.tex` loses the extension-band tie to a
          // broader file type (`dsh-resource://file/**`), because the ranking compares
          // matched pattern length. These out-specify it and still restrict by suffix
          // through `canOpen`.
          patterns: [
            'dsh-resource://file/**/*.tex',
            'dsh-resource://file/**/*.latex',
            'dsh-resource://file/**/*.ltx',
          ],
          priority: 'extension',
          title: address => titleOfAddress(address),
          canOpen: address => parseSessionAddress(address) !== undefined,
        })
        tabTypeState = 'registered'
      } catch (error) {
        tabTypeState = 'threw'
        tabTypeError = String(error?.message ?? error)
      }
      ctx.effect(() => () => {
        if (typeof disposeTabType === 'function') disposeTabType()
      })
      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: 'dsh-openprism-latex',
        locale: 'openprismLatex',
      }, LatexTab)))

      // Self report: the browser cannot expose its registries to the Host any other way, so
      // the tab registry's answer for this plugin is written to a temp file by the /files
      // route. It retries because the app may not have restored its session yet at boot.
      const sendDiagnostic = () => {
        try {
          const sessionId = readCurrentSessionId()
          const addressSession = sessionId === undefined ? 'diag-session' : sessionId
          const sampleAddress = `dsh-resource://file/session/${encodeURIComponent(addressSession)}/demo/hello.tex`
          const report = {
            build: CLIENT_BUILD,
            tabTypeState,
            tabTypeError,
            service: typeof ctx.sidebarRightTabs,
            entries: (() => {
              try {
                const entries = ctx.sidebarRightTabs?.entries?.()
                if (!Array.isArray(entries)) return `not an array: ${String(entries)}`
                return entries.map(entry => ({
                  id: entry?.id, kind: entry?.kind, priority: entry?.priority, patterns: entry?.patterns,
                }))
              } catch (error) {
                return `entries threw: ${String(error?.message ?? error)}`
              }
            })(),
            candidates: (() => {
              try {
                const list = ctx.sidebarRightTabs?.candidates?.(sampleAddress)
                if (!Array.isArray(list)) return `not an array: ${String(list)}`
                return list.map(entry => entry?.id)
              } catch (error) {
                return `candidates threw: ${String(error?.message ?? error)}`
              }
            })(),
            claim: (() => {
              try {
                return ctx.sidebarRightTabs?.claim?.(sampleAddress)?.kind
              } catch (error) {
                return `claim threw: ${String(error?.message ?? error)}`
              }
            })(),
            methods: (() => {
              try {
                const registry = ctx.sidebarRightTabs
                if (registry === undefined || registry === null) return undefined
                const names = new Set()
                for (let node = registry; node !== null && node !== Object.prototype; node = Object.getPrototypeOf(node)) {
                  for (const name of Object.getOwnPropertyNames(node)) names.add(name)
                }
                return [...names].filter(name => name !== 'constructor')
              } catch {
                return undefined
              }
            })(),
            sampleAddress,
            sessionKnown: sessionId !== undefined,
          }
          const encoded = encodeURIComponent(btoa(JSON.stringify(report)))
          fetch(`api/dsh-openprism-latex/files?session=diag&diag=${encoded}`, { cache: 'no-store' })
            .catch(() => {})
        } catch {
          /* diagnostics never affect the plugin */
        }
      }
      setTimeout(sendDiagnostic, 800)
      setTimeout(sendDiagnostic, 3000)
      setTimeout(sendDiagnostic, 8000)

      // The visible entry: one sidebar icon and the LaTeX workspace panel it opens.
      /** List the workspace's LaTeX documents through this plugin's own Host route. */
      const searchTex = async (sessionId, signal) => {
        const query = new URLSearchParams({ session: sessionId })
        const response = await fetch(`api/dsh-openprism-latex/files?${query.toString()}`, {
          signal,
          cache: 'no-store',
        })
        let body
        try {
          body = await response.json()
        } catch {
          body = undefined
        }
        if (body === undefined) {
          throw new Error(`${tr(boundT, 'panelError')} (HTTP ${response.status})`)
        }
        if (body.ok !== true) {
          throw new Error(body.error?.message ? String(body.error.message) : tr(boundT, 'panelError'))
        }
        const files = Array.isArray(body.files) ? body.files : []
        return files
          .map(entry => String(entry))
          .filter(candidate => /\.(tex|latex|ltx)$/i.test(candidate))
      }
      const loader = {
        searchTex,
        /** Whether this page's tab registry really holds the LaTeX type. */
        typeReady: () => {
          try {
            const entries = ctx.sidebarRightTabs?.entries?.()
            if (!Array.isArray(entries)) return undefined
            return entries.some(entry => entry?.id === 'dsh-openprism-latex')
          } catch {
            return undefined
          }
        },
      }
      const PanelBody = props => h(LatexPanel, { ...props, loader })

      ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: 'dsh-openprism-latex',
        order: 30,
        label: () => t('panelTitle'),
      }, PanelIcon)))
      ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: 'dsh-openprism-latex',
        locale: 'openprismLatex',
      }, PanelBody)))
    }

    return { name: 'dsh-openprism-latex', inject: ['slots', 'locale', 'sidebarRightTabs'], apply }
  },
})
