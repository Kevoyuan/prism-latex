window.__ModuleLoader__.load({
  id: 'prism-latex',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState } = React

    /** Shown in the panel header: which client bundle the page actually loaded. */
    const CLIENT_BUILD = '0.2.2+latex-tab'
    const SESSION_RESOURCE_PREFIX = 'dsh-resource://file/session/'
    const ABSOLUTE_RESOURCE_PREFIX = 'dsh-resource://file/absolute/'
    const FIXED_ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]
    const RENDER_URL = 'api/prism-latex/render'
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
      panelNoDocument: 'Open a document from the right sidebar.',
      panelIntro: 'The compiled page appears here.',
      outlineShow: 'Show the outline',
      outlineHide: 'Hide the outline',
      resizeOutline: 'Resize the outline',
      viewPreviewShow: 'Show the preview',
      viewPreviewHide: 'Hide the preview',
      statusCompiling: 'Compiling',
      statusError: 'Error',
      panelStatusReady: 'Ready',
      panelStatusIdle: 'Idle',
      panelStatusPageOne: '1 page',
      panelStatusPages: '{count} pages',
      panelStatusHint: '{state} — click to show the preview',
      panelEmptyHint: 'Open a .tex file in the right sidebar and it appears here.',
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
      resizeSplit: 'Resize the split (drag, or arrow keys)',
      findPlaceholder: 'Find in source (⌘F)',
      replacePlaceholder: 'Replace with',
      goToLine: 'Go to line (⌘G)',
      findNext: 'Next match',
      findPrevious: 'Previous match',
      toggleReplace: 'Replace',
      replaceOne: 'Replace this match',
      replaceAll: 'Replace all',
      closeFind: 'Close',
      findCount: '{current}/{total}',
      findNoMatches: 'No matches',
      completionLabel: 'Completions',
      engineLabel: 'Engine',
      jumpToLine: 'Jump to line {line}',
      jumpToSection: 'Jump to {title}',
      outlineLabel: 'Outline',
      outlineEmpty: 'No sections found',
      panelDirty: 'Unsaved changes',
      panelSectionCount: '{count} sections',
      chatOpen: 'Ask in chat',
      chatSend: 'Send to the chat',
      chatCollapse: 'Collapse the chat box',
      chatPlaceholder: 'Ask about this document…',
      chatCopied: 'Copied — paste it into the chat',
      synctexHint: 'Double-click to find the source line',
      synctexMiss: 'No source line found at that spot',
      synctexElsewhere: 'In {path} line {line}',
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
.prismlx-root {
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
.prismlx-center {
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
.prismlx-spinner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  border-top-color: var(--dsw-alias-label-secondary, #6b7280);
  animation: prismlx-spin .8s linear infinite;
}
@keyframes prismlx-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .prismlx-spinner { animation: none !important; }
}
.prismlx-status {
  color: var(--dsw-alias-label-secondary, #6b7280);
}
.prismlx-error {
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
.prismlx-error-title {
  color: var(--dsw-alias-state-error-primary, #c0392b);
  font-weight: 600;
}
.prismlx-error-message {
  color: var(--dsw-alias-label-primary, #1c1c1e);
}
.prismlx-error-line,
.prismlx-error-detail {
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 13px;
}
.prismlx-log-block {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.prismlx-log-label {
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 12px;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.prismlx-log {
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
.prismlx-button {
  appearance: none;
  cursor: pointer;
  border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  background: var(--dsw-alias-bg-overlay, #fff);
  color: var(--dsw-alias-label-primary, #1c1c1e);
  padding: 6px 14px;
  font: inherit;
}
.prismlx-button:hover {
  border-color: var(--dsw-alias-label-secondary, #6b7280);
}
.prismlx-button:focus-visible,
.prismlx-pill-button:focus-visible,
.prismlx-log:focus-visible {
  outline: 2px solid var(--dsw-alias-label-primary, #1c1c1e);
  outline-offset: 2px;
}
.prismlx-pages {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
  box-sizing: border-box;
  /* Bottom room so the sticky control pill never hides the last lines of a page. */
  padding: 14px 14px 74px;
  animation: prismlx-enter .18s ease-out;
}
@keyframes prismlx-enter {
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .prismlx-pages { animation: none; }
}
.prismlx-page {
  margin: 0 auto;
  border-radius: 3px;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .10));
  box-shadow: 0 1px 2px rgba(0, 0, 0, .06), 0 10px 28px rgba(0, 0, 0, .08);
}
.prismlx-page-image {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  -webkit-user-drag: none;
}
.prismlx-pillwrap {
  position: sticky;
  bottom: 12px;
  z-index: 2;
  display: flex;
  justify-content: center;
  margin-top: -60px;
  padding: 0 12px 12px;
  pointer-events: none;
}
.prismlx-pill {
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
.prismlx-pill-button {
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
.prismlx-pill-button:hover:enabled {
  background: var(--dsw-alias-bg-document-preview, var(--dsw-alias-bg-layer-2, #f1f2f4));
}
.prismlx-pill-button:disabled {
  cursor: default;
  opacity: .5;
  color: var(--dsw-alias-label-secondary, #6b7280);
}
.prismlx-pill-button[aria-pressed="true"] {
  background: var(--dsw-alias-bg-document-preview, var(--dsw-alias-bg-layer-2, #f1f2f4));
}
.prismlx-zoom-label {
  min-width: 44px;
  text-align: center;
  color: var(--dsw-alias-label-primary, #1c1c1e);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.prismlx-pill-divider {
  flex: 0 0 auto;
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
}
.prismlx-meta {
  padding: 0 6px;
  color: var(--dsw-alias-label-primary, #1c1c1e);
  font-size: 12px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.prismlx-glyph {
  display: block;
  flex: 0 0 auto;
}
.prismlx-tabactions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 2px;
}
.prismlx-save-button {
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
.prismlx-save-button:hover {
  filter: brightness(1.08);
}
.prismlx-save-button:focus-visible {
  outline: 2px solid var(--dsw-alias-label-primary, #1c1c1e);
  outline-offset: 1px;
}
.prismlx-error-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}
.prismlx-copied {
  color: var(--dsw-alias-state-success-primary, #2f9e63);
  font-size: 12px;
}
.prismlx-banner {
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
.prismlx-banner .prismlx-icon-button {
  color: #e5c07b;
}
.prismlx-banner .prismlx-icon-button:hover {
  background: rgba(255, 255, 255, .08);
  color: #fff;
}
.prismlx-icon-button {
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
.prismlx-icon-button:hover {
  background: var(--dsw-alias-bg-layer-2, #f1f2f4);
  color: var(--dsw-alias-label-primary, #1c1c1e);
}
.prismlx-icon-button:focus-visible {
  outline: 2px solid var(--dsw-alias-label-primary, #1c1c1e);
  outline-offset: 1px;
}
@container (max-width: 520px) {
  .prismlx-pill-meta {
    display: none;
  }
}
@container (max-width: 620px) {
  /* Keep the state dot, drop the sentence: the mode symbols and the save action matter
     more in a narrow pane. */
  .prismlx-tabstatus {
    display: none;
  }
}
@container (max-width: 430px) {
  .prismlx-pill-button[data-fit] {
    padding: 7px;
  }
}
.prismlx-note {
  padding: 0 6px;
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 12px;
  white-space: nowrap;
}
.prismlx-note[data-tone="error"] {
  color: var(--dsw-alias-state-error-primary, #c0392b);
}
.prismlx-tabroot {
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
.prismlx-toolbar {
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
.prismlx-tabmeta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}
.prismlx-tabstatus {
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
.prismlx-dot {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary, #9ca3af);
}
.prismlx-dot[data-state="ready"] {
  background: var(--dsw-alias-state-success-primary, #2f9e63);
}
.prismlx-dot[data-state="compiling"] {
  background: var(--dsw-alias-state-warn-primary, #c98a1b);
}
.prismlx-dot[data-state="error"] {
  background: var(--dsw-alias-state-error-primary, #c0392b);
}
.prismlx-modes {
  flex: 0 0 auto;
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2, #f1f2f4);
}
.prismlx-mode {
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
.prismlx-mode-icon {
  display: block;
  flex: 0 0 auto;
}
.prismlx-mode[aria-pressed="true"] .prismlx-mode-icon {
  opacity: 1;
}
.prismlx-mode:not([aria-pressed="true"]) .prismlx-mode-icon {
  opacity: .85;
}
.prismlx-mode:hover {
  color: var(--dsw-alias-label-primary, #1c1c1e);
}
.prismlx-mode[aria-pressed="true"] {
  background: var(--dsw-alias-bg-overlay, #fff);
  color: var(--dsw-alias-label-primary, #1c1c1e);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .10);
}
.prismlx-mode:focus-visible {
  outline: 2px solid var(--dsw-alias-label-primary, #1c1c1e);
  outline-offset: 1px;
}
@media (prefers-reduced-motion: reduce) {
  .prismlx-mode { transition: none; }
}
.prismlx-pane {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  container-type: inline-size;
}
.prismlx-pane[data-pane="preview"] {
  background: var(--dsw-alias-bg-document-preview, var(--dsw-alias-bg-layer-2, #f1f2f4));
}
/* One surface, two placements: the sidebar's source pane and the conversation view's editor
   column are the same material, so they share these rules instead of each declaring a colour.
   One Dark, the palette open-prism's CodeMirror editor uses (Atom One Dark, MIT); fixed dark in
   both host themes, like an inline editor island. */
.prismlx-pane[data-pane="source"],
.prismlx-editor-pane {
  background: #282c34;
  color: #abb2bf;
}
.prismlx-pane[data-pane="source"][data-editor="true"] {
  overflow: hidden;
}
.prismlx-editor-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.prismlx-editor {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  box-sizing: border-box;
}
.prismlx-chat {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-top: 1px solid var(--dsw-alias-border-l1, #e3e5e8);
  background: inherit;
}
.prismlx-chat-collapsed {
  justify-content: flex-end;
}
.prismlx-chat-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l1, #d5d8dc);
  border-radius: 7px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #1c1c1e);
  font: inherit;
  font-size: 12px;
}
.prismlx-chat-icon {
  appearance: none;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #6b7280);
  cursor: pointer;
}
.prismlx-chat-icon:hover {
  background: var(--dsw-alias-bg-layer-2, #f1f2f4);
  color: var(--dsw-alias-label-primary, #1c1c1e);
}
.prismlx-chat-note {
  flex: 0 0 auto;
  color: var(--dsw-alias-state-success-primary, #2f9e63);
  font-size: 11px;
}
.prismlx-sticky {
  appearance: none;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 22px;
  padding: 0 14px;
  border: 0;
  border-bottom: 1px solid #1f2329;
  background: rgba(15, 17, 19, .95);
  color: #c6ced8;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}
.prismlx-sticky:hover {
  background: #1b1f26;
  color: #fff;
}
.prismlx-sticky-level {
  flex: 0 0 auto;
  color: #7c8695;
}
.prismlx-sticky-text {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prismlx-complete {
  position: absolute;
  z-index: 4;
  min-width: 150px;
  max-height: 210px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid #2b2f36;
  border-radius: 8px;
  background: #191c20;
  box-shadow: 0 10px 28px rgba(0, 0, 0, .55);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--prism-code-size, 12px);
}
.prismlx-complete-item {
  padding: 3px 8px;
  border-radius: 5px;
  color: var(--prism-text, #e6e8ea);
  cursor: pointer;
  white-space: nowrap;
}
.prismlx-complete-item[data-active="true"] {
  background: #2c3240;
  color: #fff;
}
.prismlx-find {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  padding: 4px 8px;
  background: #14161a;
  border-bottom: 1px solid var(--prism-border, #26262c);
}
.prismlx-find-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 24px;
  padding: 0 8px;
  border: 1px solid #2b2f36;
  border-radius: 6px;
  background: #0f1113;
  color: var(--prism-text, #e6e8ea);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
.prismlx-find-input:focus {
  outline: none;
  border-color: #4a4f58;
}
.prismlx-find-count {
  flex: 0 0 auto;
  min-width: 44px;
  text-align: right;
  color: var(--prism-muted, #9aa0a6);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.prismlx-error-jump {
  appearance: none;
  align-self: flex-start;
  cursor: pointer;
  padding: 0;
  border: 0;
  background: transparent;
  color: #c3a6ff;
  font: inherit;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
.prismlx-error-jump:hover {
  color: #e2d4ff;
}
.prismlx-error-jump:focus-visible {
  outline: 2px solid #c3a6ff;
  outline-offset: 2px;
  border-radius: 3px;
}
.prismlx-find-action {
  appearance: none;
  cursor: pointer;
  flex: 0 0 auto;
  height: 24px;
  padding: 0 8px;
  border: 1px solid #2b2f36;
  border-radius: 6px;
  background: #1a1d21;
  color: var(--prism-text, #e6e8ea);
  font-size: 11px;
}
.prismlx-find-action:hover:enabled {
  background: #22262b;
}
.prismlx-find-action:disabled {
  opacity: .45;
  cursor: default;
}
.prismlx-replace-row {
  padding-top: 0;
}
.prismlx-match[data-kind="flash"] {
  background: rgba(168, 146, 232, .13);
  box-shadow: none;
  border-radius: 0;
  color: inherit;
}
.prismlx-match[data-kind="find"] {
  background: rgba(86, 182, 194, .16);
  box-shadow: none;
  color: #cfe9ec;
  border-radius: 2px;
}
.prismlx-match[data-kind="find-current"] {
  background: rgba(224, 165, 117, .28);
  box-shadow: inset 0 0 0 1px rgba(224, 165, 117, .7);
  color: #ffe6cd;
  border-radius: 2px;
}
.prismlx-engine {
  appearance: none;
  flex: 0 0 auto;
  height: 26px;
  max-width: 96px;
  padding: 0 6px;
  border: 1px solid var(--prism-border, #26262c);
  border-radius: 7px;
  background: var(--prism-surface, #16181a);
  color: var(--prism-text, #e6e8ea);
  font-size: 11px;
  font-family: var(--dsw-font, system-ui, sans-serif);
  cursor: pointer;
}
.prismlx-engine:hover {
  background: var(--prism-surface-2, #22262a);
}
.prismlx-engine:focus-visible {
  outline: 2px solid #4a4f58;
  outline-offset: 1px;
}
.prismlx-zoombadge {
  padding: 0 6px;
  color: var(--prism-muted, #9aa0a6);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.prismlx-gutter {
  flex: 0 0 auto;
  width: 3.4em;
  padding: 10px 8px 16px 0;
  overflow: hidden;
  box-sizing: border-box;
  text-align: right;
  color: #5c6370;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--prism-code-size, 12px);
  line-height: 1.62;
  user-select: none;
  font-variant-numeric: tabular-nums;
}
.prismlx-editor-body {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}
.prismlx-code-highlight,
.prismlx-code-input {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  margin: 0;
  padding: 10px 14px 16px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--prism-code-size, 12px);
  line-height: 1.62;
  tab-size: 2;
  white-space: pre;
  overflow-wrap: normal;
  word-break: normal;
}
.prismlx-code-highlight {
  overflow: hidden;
  pointer-events: none;
  color: #abb2bf;
}
.prismlx-code-highlight[data-hidden="true"] {
  opacity: 0;
}
.prismlx-codeline {
  white-space: pre;
  min-height: 1.62em;
}
/* The delimiter pair under the caret: a quiet box, red when unmatched. */
.prismlx-match {
  border-radius: 2px;
  background: rgba(168, 146, 232, .22);
  box-shadow: inset 0 0 0 1px rgba(168, 146, 232, .55);
  color: #e6e8ea;
}
.prismlx-match[data-kind="env"] {
  background: rgba(229, 192, 123, .16);
  box-shadow: inset 0 0 0 1px rgba(229, 192, 123, .5);
  color: #f0d9a8;
}
.prismlx-match[data-kind="broken"] {
  background: rgba(248, 81, 73, .18);
  box-shadow: inset 0 0 0 1px rgba(248, 81, 73, .6);
  color: #ffb4ae;
}
.prismlx-code-input {
  border: 0;
  outline: 0;
  resize: none;
  background: transparent;
  color: transparent;
  caret-color: #abb2bf;
  -webkit-text-fill-color: transparent;
  overflow: auto;
}
.prismlx-code-input[data-ime="true"] {
  color: #abb2bf;
  -webkit-text-fill-color: #abb2bf;
  background: #282c34;
}
.prismlx-code-input::selection {
  background: rgba(97, 175, 239, .28);
}
.prismlx-pane[data-pane="source"] .prismlx-status {
  color: #7d8799;
}
.prismlx-split {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}
.prismlx-split > [data-pane="source"] {
  flex: 0 0 auto;
  width: calc(var(--prism-split, 0.5) * 100% - 3px);
  min-width: 0;
}
.prismlx-split > [data-pane="preview"] {
  flex: 1 1 0;
  min-width: 0;
}
/* The grab bar between source and page: 6px hit area, 1px visible line. */
.prismlx-divider {
  position: relative;
  flex: 0 0 6px;
  cursor: col-resize;
  background: transparent;
  touch-action: none;
}
.prismlx-divider::before {
  content: '';
  position: absolute;
  inset: 0 2px;
  background: var(--prism-border, #26262c);
  transition: background .12s ease;
}
.prismlx-divider:hover::before,
.prismlx-divider:focus-visible::before,
.prismlx-divider[data-dragging="true"]::before {
  background: #4a4a56;
}
.prismlx-divider:focus-visible {
  outline: none;
}
.prismlx-split > .prismlx-pane + .prismlx-pane {
  border-left: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
}
.prismlx-progress {
  position: sticky;
  top: 0;
  z-index: 3;
  height: 2px;
  overflow: hidden;
  background: var(--dsw-alias-bg-layer-2, #e6e8eb);
}
.prismlx-progress::after {
  content: "";
  display: block;
  width: 38%;
  height: 100%;
  border-radius: 2px;
  background: var(--dsw-alias-brand-primary, #247bbf);
  animation: prismlx-sweep 1.15s ease-in-out infinite;
}
@keyframes prismlx-sweep {
  0% { transform: translateX(-40%); }
  100% { transform: translateX(280%); }
}
@media (prefers-reduced-motion: reduce) {
  .prismlx-progress::after { animation: none; width: 100%; opacity: .55; }
}
.prismlx-source {
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
.prismlx-srcline {
  display: flex;
  gap: 14px;
  white-space: pre;
}
.prismlx-srcline:hover {
  background: rgba(255, 255, 255, .045);
}
.prismlx-lineno {
  flex: 0 0 auto;
  width: 3em;
  text-align: right;
  color: #5c6370;
  user-select: none;
  font-variant-numeric: tabular-nums;
}
.prismlx-linetext {
  white-space: pre;
}
.prismlx-tok[data-type="comment"],
.prismlx-tok[data-type="cdata"] {
  color: #7f8896;
  font-style: italic;
}
.prismlx-tok[data-type="function"] {
  color: #61afef;
}
.prismlx-tok[data-type="keyword"] {
  color: #c678dd;
}
.prismlx-tok[data-type="headline"] {
  color: #e5c07b;
  font-weight: 600;
}
.prismlx-tok[data-type="equation"] {
  color: #56b6c2;
}
.prismlx-tok[data-type="equation-command"],
.prismlx-tok[data-type="regex"] {
  color: #56b6c2;
}
.prismlx-tok[data-type="url"] {
  color: #d19a66;
  text-decoration: underline dotted;
}
.prismlx-tok[data-type="punctuation"] {
  color: #abb2bf;
  opacity: .9;
}
.prismlx-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.prismlx-chip-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prismlx-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  /* The shell's composer can sit over this view's bottom edge; the view measures the
   * covered height and sets the inset, so the editor never runs underneath it. */
  padding-bottom: var(--prism-composer-inset, 0px);
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #1c1c1e);
  font-family: var(--dsw-font, system-ui, -apple-system, sans-serif);
  font-size: var(--dsh-content-font-size, 14px);
}
.prismlx-panel-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 16px 10px;
}
.prismlx-panel-heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}
/* The view is an editor, so its own name speaks the editor's voice: the same mono as the code
 * and the rail labels, not one more app heading in the system face. The subtitle keeps the
 * UI face, which is where file names and counts belong. */
.prismlx-panel-title {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: .02em;
  line-height: 1.4;
}
.prismlx-panel-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 12px;
  line-height: 1.4;
}
.prismlx-panel-doc-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prismlx-panel-dirty {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-state-warning-primary, #d29922);
}
.prismlx-panel-count {
  flex: 0 0 auto;
}
.prismlx-panel-status {
  appearance: none;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  margin-top: 1px;
  padding: 0 9px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-1, #fff);
  color: var(--dsw-alias-label-secondary, #6b7280);
  font: inherit;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
.prismlx-panel-status:hover {
  border-color: var(--dsw-alias-label-secondary, #6b7280);
  color: var(--dsw-alias-label-primary, #1c1c1e);
}
.prismlx-panel-status:focus-visible {
  outline: 2px solid var(--dsw-alias-label-primary, #1c1c1e);
  outline-offset: 2px;
}
.prismlx-panel-status-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #9ca3af;
}
.prismlx-panel-status[data-tone="ready"] .prismlx-panel-status-dot { background: #3fb950; }
.prismlx-panel-status[data-tone="compiling"] .prismlx-panel-status-dot { background: #d29922; }
.prismlx-panel-status[data-tone="error"] .prismlx-panel-status-dot { background: #f85149; }
.prismlx-panel-status-label {
  color: inherit;
}
.prismlx-panel-status-detail {
  color: var(--dsw-alias-label-secondary, #6b7280);
  opacity: .85;
}
.prismlx-panel-blank {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px 32px;
  text-align: center;
}
.prismlx-panel-blank-title {
  color: var(--dsw-alias-label-primary, #1c1c1e);
  font-size: 14px;
  font-weight: 500;
}
.prismlx-panel-blank-hint {
  max-width: 42ch;
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 12px;
  line-height: 1.5;
}
.prismlx-panel-note {
  padding: 12px 16px;
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 13px;
  line-height: 1.5;
}
.prismlx-workspace {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.prismlx-outline {
  display: flex;
  flex-direction: column;
  flex: 0 0 var(--prism-outline-width, 196px);
  width: var(--prism-outline-width, 196px);
  min-height: 0;
  min-width: 0;
  /* The outline is a fixed rail: it never moves with the editor's scroll. It sticks to the
   * top of whatever scrolls around it and keeps its own scrollbar for long documents. */
  position: sticky;
  top: 0;
  align-self: flex-start;
  max-height: 100%;
  overflow: auto;
}
.prismlx-outline-title {
  flex: 0 0 auto;
  /* The label rides the top of its own column: on a long document the rows scroll under
   * it, and the panel's ground keeps them from showing through the text. */
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 10px 16px 4px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.prismlx-outline-empty {
  padding: 8px 16px;
  color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 12px;
  line-height: 1.5;
}
.prismlx-outline-row {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 4px 10px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary, #1c1c1e);
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
}
.prismlx-outline-rail {
  flex: 0 0 2px;
  align-self: stretch;
  min-height: 12px;
  margin: 1px 0;
  border-radius: 1px;
  /* A 2px marker is only seen at 3:1 or better. The border token this used to borrow sat
   * near 1.3:1 on the dark panel, so every row's marker was invisible. currentColor follows
   * the row's text token in either theme; at .45 it measures about 3.9:1 on the panel and
   * still reads as a marker rather than a border. */
  background: currentColor;
  opacity: .45;
}
.prismlx-outline-row[data-active="true"] .prismlx-outline-rail {
  background: var(--prism-accent, #3f8efc);
  opacity: 1;
}
.prismlx-outline-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prismlx-outline-row:hover {
  background: var(--dsw-alias-bg-layer-2, #f4f5f7);
}
.prismlx-outline-row:focus-visible {
  outline: 2px solid var(--dsw-alias-label-primary, #1c1c1e);
  outline-offset: -2px;
}
.prismlx-outline-row[data-active="true"] {
  color: var(--dsw-alias-label-primary, #1c1c1e);
  background: var(--dsw-alias-bg-layer-2, #f4f5f7);
  box-shadow: inset 2px 0 0 var(--prism-accent, #3f8efc);
  font-weight: 500;
}
.prismlx-workspace[data-preview="false"] .prismlx-editor-pane {
  flex: 1 1 100%;
  border-right: 0;
}
.prismlx-workspace > .prismlx-divider {
  flex: 0 0 6px;
}
.prismlx-workspace > .prismlx-divider::before {
  background: var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
}
.prismlx-workspace > .prismlx-divider:hover::before,
.prismlx-workspace > .prismlx-divider:focus-visible::before,
.prismlx-workspace > .prismlx-divider[data-dragging="true"]::before {
  background: var(--dsw-alias-label-secondary, #6b7280);
}
.prismlx-editor-pane {
  display: flex;
  flex-direction: column;
  flex: 1 1 46%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  border-right: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  /* Background and text colour come from the shared source-pane rule: this column and the
   * sidebar's source pane are the same material, so neither may declare its own. */
}
.prismlx-editor-pane > .prismlx-editor-shell {
  flex: 1 1 auto;
  min-height: 0;
}
.prismlx-editor-pane .prismlx-panel-note {
  color: #7d8799;
}
.prismlx-panel-doc {
  position: relative;
  flex: 1 1 54%;
  min-width: 0;
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
.prismlx-tabroot,
.prismlx-root {
  --prism-bg: #0c0e0f;
  --prism-canvas: #0b0d0e;
  --prism-surface: #16181a;
  --prism-surface-2: #22262a;
  --prism-border: #24282c;
  --prism-text: #e6e8ea;
  --prism-muted: #9aa0a6;
  --prism-accent: #3f8efc;
  --prism-ready: #3fb950;
  --prism-warn: #d29922;
  --prism-danger: #f85149;
  background: var(--prism-bg);
  color: var(--prism-text);
}
.prismlx-toolbar {
  background: var(--prism-bg);
  border-bottom-color: var(--prism-border);
}
.prismlx-tabstatus {
  color: var(--prism-muted);
}
.prismlx-dot[data-state="ready"] { background: var(--prism-ready); }
.prismlx-dot[data-state="compiling"] { background: var(--prism-warn); }
.prismlx-dot[data-state="error"] { background: var(--prism-danger); }
.prismlx-dot[data-state="idle"] { background: #5c6370; }
.prismlx-modes {
  background: var(--prism-surface-2);
}
.prismlx-mode {
  color: var(--prism-muted);
}
.prismlx-mode:hover {
  color: var(--prism-text);
}
.prismlx-mode[aria-pressed="true"] {
  background: #34343c;
  color: #fff;
  box-shadow: none;
}
.prismlx-icon-button {
  color: var(--prism-muted);
}
.prismlx-icon-button:hover {
  /* The --prism-* palette only exists on the sidebar roots; the conversation view mounts
   * .prismlx-panel, where those names are undefined and the declaration would be invalid.
   * The shell token is the same layer, so the chip still appears there. */
  background: var(--prism-surface-2, var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, .16)));
  color: var(--prism-text, var(--dsw-alias-label-primary, #fff));
}
/* Pressed is a state, not a hover. The Outline and preview toggles already carry
 * aria-pressed, so the header can show which column is on without a pointer, and the
 * fill survives hovering the control it describes. */
.prismlx-icon-button[aria-pressed="true"] {
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, .16));
  color: var(--dsw-alias-label-primary, #1c1c1e);
}
.prismlx-icon-button:disabled {
  opacity: .45;
}
.prismlx-save-button {
  background: var(--prism-accent);
  color: #08080a;
}
.prismlx-save-button:hover {
  filter: brightness(1.1);
}
.prismlx-pane[data-pane="preview"] {
  background: var(--prism-canvas);
}
.prismlx-pane[data-pane="source"],
.prismlx-editor-pane {
  background: #0f1113;
}
.prismlx-page {
  background: #fff;
  border-color: #2b2b33;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .55), 0 14px 36px rgba(0, 0, 0, .55);
}
.prismlx-pill {
  background: #1a1a20;
  border-color: var(--prism-border);
  color: var(--prism-text);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .5);
}
.prismlx-pill-button {
  color: var(--prism-muted);
}
.prismlx-pill-button:hover:enabled {
  background: var(--prism-surface-2);
  color: #fff;
}
.prismlx-pill-button[aria-pressed="true"] {
  background: #34343c;
  color: #fff;
}
.prismlx-pill-button:disabled {
  color: #5c6370;
}
.prismlx-pill-divider {
  background: var(--prism-border);
}
.prismlx-zoom-label {
  color: var(--prism-text);
}
.prismlx-meta {
  color: var(--prism-text);
}
.prismlx-note {
  color: var(--prism-muted);
}
.prismlx-note[data-tone="error"] {
  color: var(--prism-danger);
}
.prismlx-status {
  color: var(--prism-muted);
}
.prismlx-spinner {
  border-color: #2a2a31;
  border-top-color: var(--prism-text);
}
.prismlx-error {
  background: #14141a;
  border-color: var(--prism-border);
  color: var(--prism-text);
  box-shadow: 0 12px 32px rgba(0, 0, 0, .55);
}
.prismlx-error-title {
  color: var(--prism-danger);
}
.prismlx-error-message {
  color: var(--prism-text);
}
.prismlx-error-line,
.prismlx-error-detail,
.prismlx-log-label {
  color: var(--prism-muted);
}
.prismlx-log {
  background: var(--prism-canvas);
  border-color: var(--prism-border);
  color: #d6d6da;
}
.prismlx-error-actions .prismlx-icon-button {
  color: var(--prism-muted);
}
.prismlx-copied {
  color: var(--prism-ready);
}
.prismlx-banner {
  background: #241d0e;
  border-bottom-color: var(--prism-border);
  color: #e5c07b;
}
.prismlx-gutter {
  background: #000;
  color: #4b545e;
}
.prismlx-source {
  background: #000;
  color: #e6e8ea;
}
/* The editor is the one surface that goes fully black: the panel and the preview around it
   keep their own grey so the code area reads as the focus of the view. */
.prismlx-source .prismlx-editor-body,
.prismlx-source .prismlx-gutter,
.prismlx-source .prismlx-code-highlight,
.prismlx-source .prismlx-code-input {
  background: #000;
}
.prismlx-source .prismlx-code-input[data-ime="true"] {
  background: #101010;
}
/* Token classes follow codemirror-lang-latex, the grammar Open-Prism's editor uses:
   CtrlSeq → command, EnvName → environment, sectioning → section, Comment, Bracket,
   math → MathChar, optional arguments → option. Hues sampled from Codex's preview. */
/* Comment grey is the one token that must clear 4.5:1 as body text: #7f8896 measures
 * 5.9:1 on the black editor and 5.4:1 on the panel, and still sits behind the code hues. */
.prismlx-tok[data-type="comment"],
.prismlx-tok[data-type="cdata"] {
  color: #7f8896;
  font-style: italic;
}
.prismlx-tok[data-type="command"] {
  color: #a892e8;
}
.prismlx-tok[data-type="section"] {
  color: #a892e8;
  font-weight: 600;
}
.prismlx-tok[data-type="environment"] {
  color: #e5c07b;
}
.prismlx-tok[data-type="option"] {
  color: #e0a575;
}
.prismlx-tok[data-type="math"] {
  color: #56b6c2;
}
.prismlx-tok[data-type="number"] {
  color: #d19a66;
}
.prismlx-tok[data-type="string"] {
  color: #98c379;
}
.prismlx-tok[data-type="bracket"] {
  color: #8b929a;
}
`

    let boundT = function fallbackTranslate(key) {
      return typeof en[key] === 'string' ? en[key] : key
    }

    /**
     * Cross-surface inverse search. The conversation view and the right sidebar's previews
     * are separate React trees of one plugin instance, so a page double-click in one has to
     * reach the other through module state: a tiny replaying channel, not a service.
     */
    let lastJump
    const jumpListeners = new Set()
    /** Last few jump steps, reported with the diagnostic so a silent miss is diagnosable. */
    const jumpTrace = []
    let diagFlush = () => {}
    const traceJump = (step, detail) => {
      jumpTrace.push({ step, ...detail, at: Date.now() })
      if (jumpTrace.length > 8) jumpTrace.shift()
      try {
        setTimeout(() => diagFlush(), 250)
      } catch {
        /* the diagnostic is best effort */
      }
    }

    /** Publish one SyncTeX hit to every mounted surface. */
    function publishJump(next) {
      if (next === null || typeof next !== 'object') return
      if (typeof next.path !== 'string' || next.path === '') return
      if (!Number.isFinite(Number(next.line))) return
      lastJump = {
        debug: next.debug,
        line: Number(next.line),
        column: Number.isFinite(Number(next.column)) ? Math.max(0, Number(next.column)) : 0,
        path: next.path,
        sessionId: typeof next.sessionId === 'string' ? next.sessionId : undefined,
        at: Date.now(),
      }
      traceJump('publish', { line: lastJump.line, column: lastJump.column, path: lastJump.path })
      for (const listener of [...jumpListeners]) {
        try {
          listener(lastJump)
        } catch {
          /* one bad listener must not silence the rest */
        }
      }
    }

    /**
     * Subscribe to published jumps. The latest hit is mirrored on subscribe, so a surface
     * that mounts just after a click still lands on it; returns the unsubscribe.
     */
    function subscribeJump(listener) {
      if (typeof listener !== 'function') return () => {}
      jumpListeners.add(listener)
      if (lastJump !== undefined) {
        try {
          listener(lastJump)
        } catch {
          /* the subscriber's own failure is not the publisher's problem */
        }
      }
      return () => {
        jumpListeners.delete(listener)
      }
    }

    /**
     * The document the right sidebar is showing. The conversation view mirrors whatever the
     * user opened there, so the sidebar tab publishes its address and every view picks it up.
     */
    let currentDocument
    const documentListeners = new Set()

    /** Publish the document a sidebar surface is showing. */
    function publishDocument(next) {
      if (next === null || typeof next !== 'object') return
      if (typeof next.path !== 'string' || next.path === '') return
      currentDocument = {
        path: next.path,
        sessionId: typeof next.sessionId === 'string' ? next.sessionId : undefined,
        at: Date.now(),
      }
      for (const listener of [...documentListeners]) {
        try {
          listener(currentDocument)
        } catch {
          /* one bad listener must not silence the rest */
        }
      }
    }

    /**
     * Subscribe to the current document. The latest one is mirrored on subscribe, so a view
     * that mounts after the sidebar tab still shows the right file; returns the unsubscribe.
     */
    function subscribeDocument(listener) {
      if (typeof listener !== 'function') return () => {}
      documentListeners.add(listener)
      if (currentDocument !== undefined) {
        try {
          listener(currentDocument)
        } catch {
          /* the subscriber's own failure is not the publisher's problem */
        }
      }
      return () => {
        documentListeners.delete(listener)
      }
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

    /**
     * Any file address this plug-in can show: `…/file/session/<id>/<path>` and
     * `…/file/absolute/<path>`. An absolute address has no session, so callers fall
     * back to the session on screen when they need a workspace root.
     */
    function parseFileAddress(address) {
      const scoped = parseSessionAddress(address)
      if (scoped !== undefined) return { ...scoped, absolute: false }
      if (typeof address !== 'string' || !address.startsWith(ABSOLUTE_RESOURCE_PREFIX)) return undefined
      const rest = address.slice(ABSOLUTE_RESOURCE_PREFIX.length)
      if (rest === '') return undefined
      let filePath
      try {
        filePath = rest.split('/').map(segment => decodeURIComponent(segment)).join('/')
      } catch {
        return undefined
      }
      if (filePath === '') return undefined
      return { sessionId: undefined, path: filePath, absolute: true }
    }

    /** Sectioning commands the outline knows about, in nesting order. */
    const SECTION_PATTERN = /^\s*\\(part|chapter|section|subsection|subsubsection|paragraph)\*?\s*\{/

    /**
     * The document outline: one entry per sectioning command with its 1-based line, depth
     * and plain-text title. Drives the sticky header and the panel's Outline list.
     */
    function collectSections(text) {
      const sections = []
      if (typeof text !== 'string' || text === '') return sections
      const lines = text.split('\n')
      const depth = { part: 1, chapter: 2, section: 3, subsection: 4, subsubsection: 5, paragraph: 6 }
      for (let index = 0; index < lines.length; index += 1) {
        const match = SECTION_PATTERN.exec(lines[index])
        if (match === null) continue
        const start = lines[index].indexOf('{', match.index)
        if (start === -1) continue
        let raw = ''
        let line = index
        let scan = start + 1
        while (line < lines.length && raw.length < 400) {
          const source = lines[line]
          let closed = false
          for (; scan < source.length; scan += 1) {
            if (source[scan] === '}') {
              closed = true
              break
            }
            raw += source[scan]
          }
          if (closed || line === index + 3) break
          raw += ' '
          line += 1
          scan = 0
        }
        const title = raw
          .replace(/\\[A-Za-z@]+\*?/g, ' ')
          .replace(/[{}]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        sections.push({
          line: index + 1,
          level: depth[match[1]] ?? 3,
          title: title === '' ? `\\${match[1]}` : title,
        })
      }
      return sections
    }

    /** Offset of the first character of a 1-based line, clamped to the document. */
    function lineStartOffset(text, line) {
      const target = Math.max(1, Math.floor(Number(line)) || 1)
      let offset = 0
      for (let current = 1; current < target; current += 1) {
        const newline = text.indexOf('\n', offset)
        if (newline === -1) return offset
        offset = newline + 1
      }
      return offset
    }

    /** Number of the 1-based line that contains `offset`. */
    function lineNumberAt(text, offset) {
      const limit = Math.max(0, Math.min(text.length, Math.floor(Number(offset) || 0)))
      let line = 1
      for (let index = 0; index < limit; index += 1) {
        if (text[index] === '\n') line += 1
      }
      return line
    }

    /** Whether an address ends in a LaTeX suffix: the only thing `canOpen` may check. */
    function isLatexAddress(address) {
      if (typeof address !== 'string') return false
      const clean = address.split('?')[0].split('#')[0]
      return /\.(tex|latex|ltx)$/i.test(clean)
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

    /**
     * Should this key event zoom the page? Returns the direction (1, -1, 0 for fit) or undefined.
     *
     * The page preview and the editor both live on ⌘= / ⌘- / ⌘0: the editor uses them for its
     * type size, so an event that started in a text field belongs to the editor and is skipped.
     */
    function zoomIntent(event) {
      if (event === null || event === undefined) return undefined
      if (!(event.metaKey || event.ctrlKey)) return undefined
      const target = event.target
      const tag = target !== null && target !== undefined && typeof target.tagName === 'string'
        ? target.tagName.toLowerCase()
        : ''
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable === true) return undefined
      if (event.key === '=' || event.key === '+') return 1
      if (event.key === '-' || event.key === '_') return -1
      if (event.key === '0') return 0
      return undefined
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
        className: 'prismlx-pill-button',
        'aria-label': label,
        title: label,
        onClick,
        disabled: disabled === true,
        ...extra,
      }, symbol)
    }

    function renderCompiling(t) {
      return h('div', { className: 'prismlx-center', role: 'status', key: 'compiling' }, [
        h('div', { className: 'prismlx-spinner', 'aria-hidden': 'true', key: 'spinner' }),
        h('div', { className: 'prismlx-status', key: 'label' }, tr(t, 'compiling')),
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
        h('div', { className: 'prismlx-error-title', key: 'title' }, tr(t, 'errorTitle')),
        h('div', { className: 'prismlx-error-message', key: 'message' }, message),
      ]
      if (line !== undefined) {
        const label = tr(t, 'errorLine', { line })
        // With a handler the row jumps the editor to that line; without one it stays text.
        children.push(typeof options?.onJumpLine === 'function'
          ? h('button', {
            type: 'button',
            className: 'prismlx-error-jump',
            key: 'line',
            'aria-label': tr(t, 'jumpToLine', { line }),
            title: tr(t, 'jumpToLine', { line }),
            onClick: () => options.onJumpLine(line),
          }, label)
          : h('div', { className: 'prismlx-error-line', key: 'line' }, label))
      }
      if (detail !== '') {
        children.push(h('div', { className: 'prismlx-error-detail', key: 'detail' }, detail))
      }
      if (logTail !== '') {
        children.push(h('div', { className: 'prismlx-log-block', key: 'log' }, [
          h('div', { className: 'prismlx-log-label', key: 'log-label' }, tr(t, 'logLabel')),
          h('pre', { className: 'prismlx-log', key: 'log-body', tabIndex: 0 }, logTail),
        ]))
      }
      const actions = []
      if (retryable) {
        actions.push(h('button', {
          type: 'button',
          className: 'prismlx-icon-button',
          key: 'retry',
          'aria-label': tr(t, 'retry'),
          title: tr(t, 'retry'),
          onClick: options?.onRetry,
        }, glyph('retry', 15)))
      }
      actions.push(h('button', {
        type: 'button',
        className: 'prismlx-icon-button',
        key: 'copy',
        'aria-label': tr(t, 'copyError'),
        title: tr(t, 'copyError'),
        onClick: options?.onCopy,
      }, glyph('copy', 15)))
      if (typeof options?.onSend === 'function') {
        actions.push(h('button', {
          type: 'button',
          className: 'prismlx-icon-button',
          key: 'send',
          'aria-label': tr(t, 'sendToChat'),
          title: tr(t, 'sendToChat'),
          onClick: options.onSend,
        }, glyph('send', 15)))
      }
      if (options?.copied === true) {
        actions.push(h('span', { className: 'prismlx-copied', key: 'copied', role: 'status' },
          tr(t, 'copied')))
      }
      children.push(h('div', { className: 'prismlx-error-actions', key: 'actions' }, actions))
      return h('div', { className: 'prismlx-center', key: 'error' },
        h('div', { className: 'prismlx-error', role: 'alert' }, children))
    }

    function renderReady(context) {
      const { t, address, state, zoom, setZoom, fitScale, download, onDownload, onPageDoubleClick } = context
      const dpi = Number.isFinite(state.dpi) && state.dpi > 0 ? state.dpi : 144
      const fit = zoom === 'fit'
      const pages = state.pages.map((page, index) => {
        const pixelWidth = Number(page.width) > 0 ? Number(page.width) : 1
        const pixelHeight = Number(page.height) > 0 ? Number(page.height) : 1
        const cssWidth = (pixelWidth / dpi) * 96
        const style = fit
          ? { width: '100%', maxWidth: `${Math.max(1, Math.round(cssWidth))}px` }
          : { width: `${Math.max(1, Math.round(cssWidth * zoom))}px` }
        return h('div', { className: 'prismlx-page', key: `page-${index}`, style }, h('img', {
          className: 'prismlx-page-image',
          src: page.url,
          width: pixelWidth,
          height: pixelHeight,
          alt: tr(t, 'pageAlt', { index: index + 1 }),
          title: typeof onPageDoubleClick === 'function' ? tr(t, 'synctexHint') : undefined,
          loading: 'lazy',
          decoding: 'async',
          draggable: false,
          onDoubleClick: typeof onPageDoubleClick === 'function'
            ? event => onPageDoubleClick(index, event)
            : undefined,
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
        h('span', { className: 'prismlx-zoom-label', key: 'zoom-label', 'aria-live': 'polite' }, zoomLabel),
        pillButton(t, 'zoom-in', 'zoomIn', '+', () => {
          if (stepUp !== undefined) setZoom(stepUp)
        }, stepUp === undefined),
        h('span', { className: 'prismlx-pill-divider', key: 'divider-1', 'aria-hidden': 'true' }),
        pillButton(t, 'fit-width', 'fitWidth', glyph('fit'), () => setZoom('fit'), false, {
          'data-fit': 'true',
          'aria-pressed': fit ? 'true' : 'false',
        }),
        h('span', { className: 'prismlx-pill-divider', key: 'divider-2', 'aria-hidden': 'true' }),
        h('span', { className: 'prismlx-meta prismlx-pill-meta', key: 'meta' },
          formatMeta(t, state.pageCount, state.durationMs)),
      ]
      if (state.truncated === true) {
        pill.push(h('span', { className: 'prismlx-note prismlx-pill-meta', key: 'truncated' },
          tr(t, 'truncated', { count: state.pageCount })))
      }
      if (state.refreshing === true) {
        pill.push(h('span', { className: 'prismlx-note prismlx-pill-meta', key: 'refreshing', role: 'status' },
          tr(t, 'recompiling')))
      }
      if (download.status === 'busy') {
        pill.push(h('span', { className: 'prismlx-note', key: 'download-busy', role: 'status' },
          tr(t, 'downloadBusy')))
      }
      if (download.status === 'failed') {
        pill.push(h('span', {
          className: 'prismlx-note',
          key: 'download-failed',
          role: 'status',
          'data-tone': 'error',
        }, tr(t, 'downloadFailed')))
      }
      pill.push(h('span', { className: 'prismlx-pill-divider', key: 'divider-3', 'aria-hidden': 'true' }))
      pill.push(h('button', {
        type: 'button',
        className: 'prismlx-pill-button',
        key: 'download',
        'aria-label': tr(t, 'download'),
        title: tr(t, 'download'),
        'aria-busy': download.status === 'busy',
        onClick: onDownload,
        disabled: state.pdfUrl === '' || download.status === 'busy',
      }, glyph('download')))

      return [
        h('div', { className: 'prismlx-pages', key: 'pages' }, pages),
        h('div', { className: 'prismlx-pillwrap', key: 'pillwrap' },
          h('div', { className: 'prismlx-pill', role: 'group', 'aria-label': tr(t, 'controls') }, pill)),
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

    /** The three delimiter pairs an editor pairs; LaTeX uses all of them. */
    const BRACKET_PAIRS = { '{': '}', '[': ']', '(': ')' }
    const BRACKET_CLOSERS = { '}': '{', ']': '[', ')': '(' }

    /** Whether the character at `offset` is escaped by a backslash run. */
    function isEscaped(text, offset) {
      let slashes = 0
      let index = offset - 1
      while (index >= 0 && text[index] === '\\') {
        slashes += 1
        index -= 1
      }
      return slashes % 2 === 1
    }

    /** Whether `offset` sits inside a `%` comment that starts on its own line. */
    function isCommented(text, offset) {
      let index = offset
      while (index > 0 && text[index - 1] !== '\n') index -= 1
      for (let scan = index; scan < offset; scan += 1) {
        if (text[scan] === '%' && !isEscaped(text, scan)) return true
      }
      return false
    }

    /** Offset of the delimiter closing the one at `openOffset`, or -1. */
    function findClosing(text, openOffset) {
      const opener = text[openOffset]
      const closer = BRACKET_PAIRS[opener]
      let depth = 0
      for (let index = openOffset; index < text.length; index += 1) {
        const ch = text[index]
        if (isEscaped(text, index) || isCommented(text, index)) continue
        if (ch === opener) depth += 1
        else if (ch === closer) {
          depth -= 1
          if (depth === 0) return index
        }
      }
      return -1
    }

    /** Offset of the delimiter opening the one at `closeOffset`, or -1. */
    function findOpening(text, closeOffset) {
      const closer = text[closeOffset]
      const opener = BRACKET_CLOSERS[closer]
      let depth = 0
      for (let index = closeOffset; index >= 0; index -= 1) {
        const ch = text[index]
        if (isEscaped(text, index) || isCommented(text, index)) continue
        if (ch === closer) depth += 1
        else if (ch === opener) {
          depth -= 1
          if (depth === 0) return index
        }
      }
      return -1
    }

    /**
     * The delimiter pair at the caret, for highlighting.
     *
     * Checks the character before the caret first (where the caret sits after
     * typing), then the one after it. An unmatched delimiter reports the pair with
     * -1 on the missing side so the UI can tint it as broken.
     */
    function matchDelimiterAt(text, caret) {
      for (const offset of [caret - 1, caret]) {
        if (offset < 0 || offset >= text.length) continue
        const ch = text[offset]
        if (BRACKET_PAIRS[ch] !== undefined) {
          if (isEscaped(text, offset) || isCommented(text, offset)) continue
          return { open: offset, close: findClosing(text, offset) }
        }
        if (BRACKET_CLOSERS[ch] !== undefined) {
          if (isEscaped(text, offset) || isCommented(text, offset)) continue
          return { open: findOpening(text, offset), close: offset }
        }
      }
      return undefined
    }

    /** Every `\\begin{name}` / `\\end{name}` token, with the name's position. */
    function environmentSpans(text) {
      const spans = []
      const pattern = /\\(begin|end)\s*\{([^}]*)\}/g
      let found = pattern.exec(text)
      while (found !== null) {
        const name = found[2]
        const offsetInToken = name === '' ? -1 : found[0].indexOf(name)
        spans.push({
          kind: found[1],
          name,
          start: found.index,
          end: found.index + found[0].length,
          nameStart: offsetInToken < 0 ? -1 : found.index + offsetInToken,
        })
        found = pattern.exec(text)
      }
      return spans
    }

    /**
     * The environment pair the caret sits in, for highlighting both `\\begin` and
     * `\\end` names. Nesting of the same environment is honoured.
     */
    function matchEnvironmentAt(text, caret) {
      const spans = environmentSpans(text)
      const index = spans.findIndex(span => caret >= span.start - 1 && caret <= span.end)
      if (index < 0) return undefined
      const target = spans[index]
      if (target.nameStart < 0) return undefined
      let depth = 0
      if (target.kind === 'begin') {
        for (let scan = index; scan < spans.length; scan += 1) {
          const span = spans[scan]
          if (span.name !== target.name) continue
          depth += span.kind === 'begin' ? 1 : -1
          if (depth === 0) {
            return {
              env: target.name,
              begin: { at: target.nameStart, length: target.name.length },
              end: { at: span.nameStart, length: span.name.length },
            }
          }
        }
      } else {
        for (let scan = index; scan >= 0; scan -= 1) {
          const span = spans[scan]
          if (span.name !== target.name) continue
          depth += span.kind === 'end' ? 1 : -1
          if (depth === 0) {
            return {
              env: target.name,
              begin: { at: span.nameStart, length: span.name.length },
              end: { at: target.nameStart, length: target.name.length },
            }
          }
        }
      }
      return undefined
    }

    /** Map absolute ranges to per-line decoration entries. */
    function rangeDecorations(text, ranges, kind) {
      const map = new Map()
      const list = ranges.filter(range => range !== undefined && range.at >= 0 && range.length > 0)
      if (list.length === 0) return map
      let line = 0
      let lineStart = 0
      const top = Math.max(...list.map(range => range.at + range.length - 1))
      for (let index = 0; index <= top; index += 1) {
        if (text[index] === '\n') {
          line += 1
          lineStart = index + 1
        }
        for (const range of list) {
          if (range.at !== index) continue
          const entries = map.get(line) ?? []
          entries.push({ at: index - lineStart, length: range.length, kind })
          map.set(line, entries)
        }
      }
      return map
    }

    /** Merge two decoration maps into one. */
    function mergeDecorations(first, second) {
      if (first.size === 0) return second
      if (second.size === 0) return first
      const merged = new Map(first)
      for (const [line, entries] of second) {
        merged.set(line, [...(merged.get(line) ?? []), ...entries])
      }
      return merged
    }

    /** Turn absolute delimiter offsets into per-line columns for the highlight layer. */
    function bracketDecorations(text, match) {
      const map = new Map()
      if (match === undefined) return map
      const entries = []
      for (const kind of ['open', 'close']) {
        const offset = match[kind]
        if (Number.isInteger(offset) && offset >= 0 && offset < text.length) {
          entries.push({ offset, kind })
        }
      }
      if (entries.length === 0) return map
      const top = Math.max(...entries.map(entry => entry.offset))
      let line = 0
      let lineStart = 0
      for (let index = 0; index <= top; index += 1) {
        const entry = entries.find(candidate => candidate.offset === index)
        if (entry !== undefined) {
          const list = map.get(line) ?? []
          list.push({ at: index - lineStart, kind: entry.kind })
          map.set(line, list)
        }
        if (text[index] === '\n') {
          line += 1
          lineStart = index + 1
        }
      }
      const broken = match.open < 0 || match.close < 0
      if (broken) {
        for (const list of map.values()) {
          for (const item of list) item.kind = 'broken'
        }
      }
      return map
    }

    /** Control sequences offered by the completion popup, most used first. */
    const LATEX_COMMANDS = [
      'documentclass', 'usepackage', 'begin', 'end', 'section', 'subsection', 'subsubsection',
      'paragraph', 'item', 'itemize', 'enumerate', 'description', 'textbf', 'textit', 'texttt',
      'emph', 'underline', 'textsc', 'textcolor', 'color', 'centering', 'caption', 'label',
      'ref', 'eqref', 'cite', 'citep', 'citet', 'footnote', 'url', 'href', 'includegraphics',
      'frac', 'dfrac', 'tfrac', 'sqrt', 'sum', 'int', 'prod', 'left', 'right', 'mathrm',
      'mathbf', 'mathbb', 'mathcal', 'text', 'hline', 'toprule', 'midrule', 'bottomrule',
      'newpage', 'clearpage', 'tableofcontents', 'maketitle', 'vspace', 'hspace',
      'setlength', 'newcommand', 'renewcommand', 'def', 'input', 'include', 'bibliography',
      'bibliographystyle', 'fontsize', 'linespread', 'graphicspath',
    ]

    /** Environment names offered after `\\begin{`. */
    const LATEX_ENVIRONMENTS = [
      'document', 'itemize', 'enumerate', 'description', 'figure', 'table', 'tabular',
      'equation', 'equation*', 'align', 'align*', 'gather', 'gather*', 'multline', 'split',
      'array', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'cases', 'center', 'flushleft',
      'flushright', 'quote', 'quotation', 'verse', 'verbatim', 'minipage', 'abstract',
      'thebibliography',
    ]

    /** Filter a candidate list by what has been typed, prefix matches first. */
    function filterCompletions(candidates, typed) {
      const needle = typed.toLowerCase()
      const prefix = []
      const rest = []
      for (const candidate of candidates) {
        const lower = candidate.toLowerCase()
        if (needle !== '' && !lower.startsWith(needle)) {
          if (lower.includes(needle)) rest.push(candidate)
          continue
        }
        prefix.push(candidate)
      }
      return [...prefix, ...rest].slice(0, 8)
    }

    /** Labels declared in the document, for `\\ref{` and `\\cite{` completion. */
    function collectLabels(text) {
      const labels = []
      const pattern = /\\label\{([^}]*)\}/g
      let found = pattern.exec(text)
      while (found !== null) {
        if (found[1] !== '') labels.push(found[1])
        found = pattern.exec(text)
      }
      return labels
    }

    /**
     * The completion popup for the caret, if one applies: `\cmd`, `\begin{env}`,
     * `\ref{label}` or `\cite{key}` partial words.
     */
    function completionAt(text, caret, labels = []) {
      if (caret < 0 || caret > text.length) return undefined
      const lineStart = text.lastIndexOf('\n', caret - 1) + 1
      const before = text.slice(lineStart, caret)
      const environment = /\\(?:begin|end)\s*\{([A-Za-z*]*)$/.exec(before)
      if (environment !== null) {
        const items = filterCompletions(LATEX_ENVIRONMENTS, environment[1])
        return items.length === 0 ? undefined : {
          kind: 'environment',
          items,
          start: caret - environment[1].length,
        }
      }
      const reference = /\\(?:ref|eqref|cref|autoref|cite|citep|citet)\s*\{([^}]*)$/.exec(before)
      if (reference !== null) {
        const typed = reference[1].split(',').pop().trim()
        const items = filterCompletions(labels, typed)
        return items.length === 0 ? undefined : {
          kind: 'label',
          items,
          start: caret - typed.length,
        }
      }
      const command = /\\([A-Za-z]+)$/.exec(before)
      if (command !== null) {
        const items = filterCompletions(LATEX_COMMANDS, command[1])
        return items.length === 0 ? undefined : {
          kind: 'command',
          items,
          start: caret - command[1].length,
        }
      }
      return undefined
    }

    /** Measured monospace advance, so the popup can sit under the caret. */
    const charWidthCache = new Map()
    function measureCharWidth(size) {
      const key = String(size)
      const cached = charWidthCache.get(key)
      if (cached !== undefined) return cached
      let width = size * 0.6
      try {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (context !== null) {
          context.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
          width = context.measureText('MMMMMMMMMM').width / 10
        }
      } catch {
        /* fall back to the ratio estimate */
      }
      charWidthCache.set(key, width)
      return width
    }

    /** Case-insensitive literal matches of `query`, as absolute ranges. */
    function findMatches(text, query) {
      const matches = []
      if (typeof query !== 'string' || query === '') return matches
      const needle = query.toLowerCase()
      const haystack = text.toLowerCase()
      let index = haystack.indexOf(needle)
      while (index >= 0) {
        matches.push({ at: index, length: query.length })
        index = haystack.indexOf(needle, index + Math.max(1, needle.length))
      }
      return matches
    }

    /** Render one highlighted run list, falling back to the plain line text. */
    function sourceLineNodes(line, runs, decorations) {
      const plainLine = () => (line === '' ? ' ' : line)
      if (decorations === undefined || decorations.length === 0) {
        if (runs === undefined) return plainLine()
        return runs.length === 1 && runs[0].type === 'plain'
          ? runs[0].text
          : runs.map((run, index) => (run.type === 'plain'
            ? run.text
            : h('span', { className: 'prismlx-tok', 'data-type': run.type, key: `r${index}` }, run.text)))
      }
      // Delimiters need their own span, so the run text is split at those columns.
      const list = runs ?? [{ type: 'plain', text: line }]
      const parts = []
      let column = 0
      for (const run of list) {
        const text = String(run.text)
        let index = 0
        while (index < text.length) {
          const at = column + index
          const decoration = decorations.find(item => item.at === at)
          if (decoration !== undefined) {
            const length = Math.max(1, Number(decoration.length) || 1)
            parts.push(h('span', {
              className: 'prismlx-match',
              'data-kind': decoration.kind,
              key: `m${at}`,
            }, text.slice(index, index + length)))
            index += length
            continue
          }
          let stop = text.length
          for (const item of decorations) {
            const relative = item.at - at
            if (relative > 0 && relative < stop) stop = relative
          }
          const chunk = text.slice(index, stop)
          parts.push(run.type === 'plain'
            ? chunk
            : h('span', { className: 'prismlx-tok', 'data-type': run.type, key: `r${at}` }, chunk))
          index = stop
        }
        column += text.length
      }
      return parts
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
        className: 'prismlx-glyph',
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
          className: 'prismlx-glyph',
        }, h('path', { key: 'play', d: 'M8.4 5.2 19 12 8.4 18.8z', fill: 'currentColor' }))
      }
      if (name === 'up' || name === 'down') {
        return h('svg', { ...frame, key: 'glyph' }, h('path', {
          key: 'chevron',
          d: name === 'up' ? 'M6.5 14.5 12 9.2l5.5 5.3' : 'M6.5 9.5 12 14.8l5.5-5.3',
        }))
      }
      if (name === 'close') {
        return h('svg', { ...frame, key: 'glyph' }, [
          h('path', { key: 'a', d: 'M6.6 6.6l10.8 10.8' }),
          h('path', { key: 'b', d: 'M17.4 6.6 6.6 17.4' }),
        ])
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
      if (name === 'eye') {
        return h('svg', { ...frame, key: 'glyph' }, [
          h('path', {
            key: 'lid',
            d: 'M2.6 12s3.5-5.4 9.4-5.4S21.4 12 21.4 12s-3.5 5.4-9.4 5.4S2.6 12 2.6 12Z',
          }),
          h('circle', { key: 'pupil', cx: 12, cy: 12, r: 2.5 }),
        ])
      }
      if (name === 'outline') {
        return h('svg', { ...frame, key: 'glyph' }, [
          h('path', { key: 'head', d: 'M4.5 6.5h15' }),
          h('path', { key: 'row-a', d: 'M4.5 12h10' }),
          h('path', { key: 'row-b', d: 'M4.5 17.5h13' }),
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
        className: 'prismlx-mode-icon',
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
        className: 'prismlx-mode',
        'aria-label': label,
        title: label,
        'aria-pressed': mode === value,
        onClick: () => setMode(value),
      }, modeIcon(value))
    }

    /** Whether the chat bar is expanded; remembered across sessions. */
    function readChatOpen() {
      try {
        const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem('prism-latex.chat')
        return raw === 'open'
      } catch {
        return false
      }
    }

    /**
     * A composer that drives the real session.
     *
     * It is not a second model connection: the text lands in the conversation's draft via
     * `inputActions` and submits through the same action the native composer uses. Where
     * that scope is unavailable (the left panel has no input actions) it copies the text
     * instead, so the button still does something honest.
     */
    function ChatBar(props) {
      const t = typeof props.t === 'function' ? props.t : boundT
      const [open, setOpen] = useState(() => readChatOpen())
      const [text, setText] = useState('')
      const [note, setNote] = useState(undefined)

      const remember = next => {
        setOpen(next)
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('prism-latex.chat', next ? 'open' : 'closed')
          }
        } catch {
          /* preference storage is best effort */
        }
      }

      const flash = message => {
        setNote(message)
        setTimeout(() => setNote(undefined), 2000)
      }

      const send = () => {
        const value = text.trim()
        if (value === '') return
        const actions = props.inputActions
        if (actions !== null && typeof actions === 'object' && typeof actions.insertText === 'function') {
          try {
            const span = actions.captureInsertion()
            if (actions.insertText(value, span) === true) {
              if (typeof actions.submit === 'function') actions.submit()
              setText('')
              return
            }
          } catch {
            /* fall through to the clipboard */
          }
        }
        copyText(value, () => {})
        setText('')
        flash(tr(t, 'chatCopied'))
      }

      if (!open) {
        return h('div', { className: 'prismlx-chat prismlx-chat-collapsed' }, h('button', {
          type: 'button',
          className: 'prismlx-chat-icon',
          'aria-label': tr(t, 'chatOpen'),
          title: tr(t, 'chatOpen'),
          onClick: () => remember(true),
        }, glyph('send', 15)))
      }

      return h('div', { className: 'prismlx-chat' }, [
        h('input', {
          key: 'input',
          className: 'prismlx-chat-input',
          type: 'text',
          value: text,
          placeholder: tr(t, 'chatPlaceholder'),
          'aria-label': tr(t, 'chatPlaceholder'),
          onChange: event => setText(event.target.value),
          onKeyDown: event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              send()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              remember(false)
            }
          },
        }),
        h('button', {
          type: 'button',
          className: 'prismlx-chat-icon',
          key: 'send',
          'aria-label': tr(t, 'chatSend'),
          title: tr(t, 'chatSend'),
          onClick: send,
        }, glyph('send', 15)),
        h('button', {
          type: 'button',
          className: 'prismlx-chat-icon',
          key: 'collapse',
          'aria-label': tr(t, 'chatCollapse'),
          title: tr(t, 'chatCollapse'),
          onClick: () => remember(false),
        }, glyph('close', 14)),
        note === undefined ? null : h('span', { className: 'prismlx-chat-note', key: 'note', role: 'status' }, note),
      ])
    }

    /**
     * The document-preview body: used when this composition offers `documentPreviews`
     * and the sidebar's own renderer menu is in play.
     */
    function LatexBody(props) {
      const t = typeof props.t === 'function' ? props.t : boundT
      const tabInfo = typeof props.useTabInfo === 'function' ? props.useTabInfo() : undefined
      const tabSignal = tabInfo?.tab?.signal
      const address = useMemo(() => parseFileAddress(props.resourceAddress), [props.resourceAddress])
      const sessionId = address?.sessionId ?? readCurrentSessionId()
      const resource = typeof props.useResource === 'function'
        ? props.useResource(props.resourceAddress)
        : undefined
      const resourceRef = useRef(resource)
      resourceRef.current = resource
      const content = props.content
      const contentRef = useRef(content)
      contentRef.current = content

      const addressKey = address === undefined ? '' : `${address.sessionId ?? 'absolute'}\u0000${address.path}`
      const [state, setState] = useState({ status: 'compiling' })
      const [zoom, setZoomState] = useState(() => (
        addressKey === '' ? 'fit' : (zoomMemory.get(addressKey) ?? 'fit')))
      const [download, setDownload] = useState({ status: 'idle' })
      const [paneWidth, setPaneWidth] = useState(0)
      const [copied, setCopied] = useState(false)

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

        const target = parseFileAddress(props.resourceAddress)
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

        const query = new URLSearchParams({
          session: target.sessionId ?? readCurrentSessionId() ?? '',
          path: target.path,
        })
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

      /**
       * Inverse search from the document-preview pages. This surface has no editor of its
       * own, so it publishes the hit for the conversation view and never touches its own
       * layout.
       */
      const previewInverseSearchAt = (index, event) => {
        const image = event?.currentTarget
        if (address === undefined || image === null || image === undefined) return
        const rect = typeof image.getBoundingClientRect === 'function' ? image.getBoundingClientRect() : undefined
        if (rect === undefined || rect.width <= 0 || rect.height <= 0) return
        const naturalWidth = Number(image.naturalWidth) > 0 ? Number(image.naturalWidth) : rect.width
        const naturalHeight = Number(image.naturalHeight) > 0 ? Number(image.naturalHeight) : rect.height
        const pixelX = (event.clientX - rect.left) * (naturalWidth / rect.width)
        const pixelY = (event.clientY - rect.top) * (naturalHeight / rect.height)
        const dpi = Number(state.dpi) > 0 ? Number(state.dpi) : 144
        const query = new URLSearchParams({
          session: address.sessionId ?? readCurrentSessionId() ?? '',
          path: address.path,
          page: String(index + 1),
          x: (pixelX * 72 / dpi).toFixed(2),
          y: (pixelY * 72 / dpi).toFixed(2),
        })
        fetch(`api/prism-latex/synctex?${query.toString()}`, { cache: 'no-store' })
          .then(async response => {
            let body
            try {
              body = await response.json()
            } catch {
              body = undefined
            }
            if (body?.ok !== true || typeof body.line !== 'number') return
            if (body.path !== address.path) return
            publishJump({
              line: body.line,
              column: body.column,
              path: body.path,
              sessionId: address.sessionId ?? readCurrentSessionId(),
              debug: body.debug,
            })
          })
          .catch(() => {})
      }

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
          onPageDoubleClick: previewInverseSearchAt,
        }))
      }
      return h('div', { className: 'prismlx-root', ref: attachRoot }, children)
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
      const { t, text, resetToken, onInput, onSave, fontSize, onZoom, jump, onActiveSection } = props
      const [composing, setComposing] = useState(false)
      const [caret, setCaret] = useState(-1)
      const [flashLine, setFlashLine] = useState(undefined)
      const sections = useMemo(() => collectSections(text), [text])
      /** Section index that owns the first visible line; -1 when the view is above all. */
      const sectionAtTop = () => {
        let index = -1
        for (let scan = 0; scan < sections.length; scan += 1) {
          if (sections[scan].line <= 1) index = scan
          else break
        }
        return index
      }
      const [activeSection, setActiveSection] = useState(() => sectionAtTop())
      // The parent stores this index for the Outline rail. A ref keeps the callback out of
      // the effect's dependencies, whose identity changes on every panel render.
      const onActiveSectionRef = useRef(onActiveSection)
      onActiveSectionRef.current = onActiveSection
      const flashTimer = useRef(undefined)
      const [finder, setFinder] = useState({
        open: false,
        mode: 'find',
        query: '',
        replacement: '',
        replacing: false,
        index: 0,
      })
      const findRef = useRef(null)
      const [completion, setCompletion] = useState(undefined)
      const areaRef = useRef(null)
      const codeRef = useRef(null)
      const gutterRef = useRef(null)
      const lines = useMemo(() => text.split('\n'), [text])
      const highlighted = useMemo(() => highlightLatexLines(text), [text])
      const matches = finder.open && finder.mode === 'find' && finder.query !== ''
        ? findMatches(text, finder.query)
        : []
      let decorations = new Map()
      if (matches.length > 0) {
        const current = Math.min(Math.max(0, finder.index), matches.length - 1)
        for (let index = 0; index < matches.length; index += 1) {
          decorations = mergeDecorations(
            decorations,
            rangeDecorations(text, [matches[index]], index === current ? 'find-current' : 'find'),
          )
        }
      }
      if (Number.isFinite(flashLine)) {
        const start = lineStartOffset(text, flashLine)
        const end = text.indexOf('\n', start)
        const length = (end === -1 ? text.length : end) - start
        if (length > 0) {
          decorations = mergeDecorations(
            decorations,
            rangeDecorations(text, [{ at: start, length }], 'flash'),
          )
        }
      }
      if (caret >= 0) {
        decorations = bracketDecorations(text, matchDelimiterAt(text, caret))
        const environment = matchEnvironmentAt(text, caret)
        if (environment !== undefined) {
          decorations = mergeDecorations(decorations, rangeDecorations(
            text,
            [environment.begin, environment.end],
            'env',
          ))
        }
      }

      // The flash timer belongs to this component; clearing it on unmount keeps a late
      // setState out of a torn-down tree.
      useEffect(() => () => {
        if (flashTimer.current !== undefined) clearTimeout(flashTimer.current)
      }, [])

      // The textarea is uncontrolled on purpose: a controlled one loses the browser's
      // native undo stack (⌘Z) because React rewrites `value` on every keystroke. The
      // file text is adopted only when a new file version arrives.
      useEffect(() => {
        const area = areaRef.current
        if (area === null || area === undefined) return
        if (area.value !== text) area.value = text
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [resetToken])

      // The caret drives delimiter pairing: track it on selection changes, not on every
      // render, and drop the pair when a range is selected.
      useEffect(() => {
        const area = areaRef.current
        if (area === null || area === undefined || typeof document === 'undefined') return undefined
        const update = () => {
          if (document.activeElement !== area) {
            setCaret(-1)
            return
          }
          const start = area.selectionStart
          setCaret(start === area.selectionEnd ? start : -1)
        }
        update()
        document.addEventListener('selectionchange', update)
        area.addEventListener('keyup', update)
        area.addEventListener('click', update)
        return () => {
          document.removeEventListener('selectionchange', update)
          area.removeEventListener('keyup', update)
          area.removeEventListener('click', update)
        }
      }, [resetToken])

      /** Section owning the top of the viewport, recomputed on scroll only. */
      const refreshSection = () => {
        const area = areaRef.current
        if (area === null || area === undefined || sections.length === 0) return
        const row = lineHeight()
        if (!(row > 0)) return
        const topLine = Math.max(1, Math.floor((Number(area.scrollTop) - 10) / row) + 1)
        let next = -1
        for (let index = 0; index < sections.length; index += 1) {
          if (sections[index].line <= topLine) next = index
          else break
        }
        setActiveSection(previous => (previous === next ? previous : next))
      }

      useEffect(() => {
        refreshSection()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [text, resetToken])

      // The Outline rail mirrors the section the viewport is in; report the index on mount
      // and on every change. The sticky header above keeps using the same state.
      useEffect(() => {
        const callback = onActiveSectionRef.current
        if (typeof callback === 'function') callback(activeSection)
      }, [activeSection])

      /** Pending frame for a coalesced scroll sync. */
      const scrollFrame = useRef(0)
      /** Scroll events are frequent; do the work at most once per frame. */
      const onScroll = () => {
        if (scrollFrame.current !== 0) return
        if (typeof requestAnimationFrame !== 'function') {
          sync()
          return
        }
        scrollFrame.current = requestAnimationFrame(() => {
          scrollFrame.current = 0
          sync()
        })
      }
      useEffect(() => () => {
        if (scrollFrame.current !== 0 && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(scrollFrame.current)
          scrollFrame.current = 0
        }
      }, [])

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
        refreshSection()
      }

      // Completion follows the caret; it closes while an IME composition is running.
      useEffect(() => {
        if (composing || caret < 0 || finder.open) {
          setCompletion(undefined)
          return
        }
        const next = completionAt(text, caret, collectLabels(text))
        setCompletion(next)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [text, caret, composing, finder.open])

      // Follow the error card's jump request.
      useEffect(() => {
        if (jump === undefined || !Number.isFinite(jump?.line)) return
        traceJump('apply', { line: jump.line, column: jump.column, seq: jump.seq })
        goToLine(jump.line, jump.column)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [jump?.seq])

      useEffect(() => {
        if (!finder.open) return
        const input = findRef.current
        if (input === null || input === undefined) return
        try {
          input.focus()
          if (typeof input.select === 'function') input.select()
        } catch {
          /* focus is a nicety */
        }
      }, [finder.open, finder.mode])

      // Typing in the bar reveals the first match without stealing focus.
      useEffect(() => {
        if (!finder.open || finder.mode !== 'find' || finder.query === '') return
        const area = areaRef.current
        if (area === null || area === undefined) return
        const found = findMatches(text, finder.query)
        if (found.length === 0) return
        const first = found[0]
        try {
          area.setSelectionRange(first.at, first.at + first.length)
        } catch {
          /* the element may be gone */
        }
        const line = text.slice(0, first.at).split('\n').length - 1
        const height = Number.isFinite(area.clientHeight) ? area.clientHeight : 0
        area.scrollTop = Math.max(0, line * lineHeight() - height / 3)
        sync()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [finder.open, finder.query])

      /**
       * Real line box height, measured so a CSS change cannot desync the scroll.
       *
       * `getComputedStyle` forces a style flush, and a scroll handler asking for it on every
       * event made scrolling feel sticky, so the measurement is cached until the font or the
       * document changes.
       */
      const rowRef = useRef(0)
      const lineHeight = () => {
        if (rowRef.current > 0) return rowRef.current
        const area = areaRef.current
        const fallback = (Number.isFinite(fontSize) ? fontSize : CODE_FONT_DEFAULT) * 1.62
        if (area === null || area === undefined || typeof getComputedStyle !== 'function') return fallback
        try {
          const parsed = Number.parseFloat(getComputedStyle(area).lineHeight)
          const row = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
          rowRef.current = row
          return row
        } catch {
          return fallback
        }
      }
      useEffect(() => {
        rowRef.current = 0
      }, [fontSize, resetToken])

      /** Scroll one offset into view with a third of the pane above it. */
      /**
       * Scroll one offset into view.
       *
       * `top` puts the line one row below the top edge, which is what CodeMirror's
       * `scrollIntoView(..., { y: 'start' })` does. The scroll repeats on the next frame
       * because Chromium also scrolls when a textarea takes focus, and that second scroll
       * would otherwise leave the caret at the frame edge.
       */
      const scrollToOffset = (offset, align = 'middle') => {
        const area = areaRef.current
        if (area === null || area === undefined) return
        const row = lineHeight()
        const height = Number.isFinite(area.clientHeight) ? area.clientHeight : 0
        const index = text.slice(0, Math.max(0, offset)).split('\n').length - 1
        const target = align === 'top' ? 10 + index * row - row : index * row - height / 3
        const clamp = () => {
          const node = areaRef.current
          if (node === null || node === undefined) return
          const max = Math.max(0, (Number(node.scrollHeight) || 0) - height)
          node.scrollTop = Math.max(0, Math.min(max, target))
          sync()
        }
        clamp()
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(clamp)
      }

      const revealOffset = offset => scrollToOffset(offset, 'middle')

      const goToMatch = next => {
        if (matches.length === 0) return
        const index = ((next ?? finder.index) % matches.length + matches.length) % matches.length
        setFinder(previous => ({ ...previous, index }))
        const area = areaRef.current
        if (area !== null && area !== undefined) {
          try {
            area.setSelectionRange(matches[index].at, matches[index].at + matches[index].length)
          } catch {
            /* the element may be gone */
          }
          revealOffset(matches[index].at)
        }
      }

      const replaceCurrent = () => {
        const area = areaRef.current
        if (area === null || area === undefined || matches.length === 0) return
        const current = Math.min(Math.max(0, finder.index), matches.length - 1)
        const match = matches[current]
        try {
          area.setSelectionRange(match.at, match.at + match.length)
          if (document.execCommand('insertText', false, finder.replacement) !== true) throw new Error('refused')
        } catch {
          const next = `${text.slice(0, match.at)}${finder.replacement}${text.slice(match.at + match.length)}`
          area.value = next
          onInput(next)
        }
      }

      const replaceAll = () => {
        const area = areaRef.current
        if (area === null || area === undefined || finder.query === '') return
        const all = findMatches(text, finder.query)
        if (all.length === 0) return
        let next = ''
        let cursor = 0
        for (const match of all) {
          next += `${text.slice(cursor, match.at)}${finder.replacement}`
          cursor = match.at + match.length
        }
        next += text.slice(cursor)
        area.value = next
        onInput(next)
      }

      /**
       * Put the caret on a 1-based line (and an optional 0-based column), scroll it to the
       * top and flash the row so the landing is visible. Focus comes first so the caret is
       * painted, and the scroll runs after it.
       */
      const goToLine = (line, column) => {
        const lines = text.split('\n')
        const target = Math.max(1, Math.min(lines.length, Math.floor(Number(line)) || 1))
        let offset = 0
        for (let index = 0; index < target - 1; index += 1) offset += lines[index].length + 1
        const width = lines[target - 1] === undefined ? 0 : lines[target - 1].length
        const within = Math.max(0, Math.min(width, Math.floor(Number(column)) || 0))
        const caret = offset + within
        const area = areaRef.current
        if (area !== null && area !== undefined) {
          try {
            area.focus()
            area.setSelectionRange(caret, caret)
          } catch {
            /* the element may be gone */
          }
          // A jump lands with context above it; pinning the line to the top edge made the
          // reader lose the surroundings of the hit.
          scrollToOffset(offset, 'middle')
        }
        setCaret(caret)
        setFlashLine(target)
        if (flashTimer.current !== undefined) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setFlashLine(undefined), 1600)
      }

      const acceptCompletion = explicitIndex => {
        const area = areaRef.current
        if (completion === undefined || area === null || area === undefined) return
        const wanted = explicitIndex === undefined ? (completion.index ?? 0) : explicitIndex
        const index = Math.min(Math.max(0, wanted), completion.items.length - 1)
        const item = completion.items[index]
        const end = area.selectionStart
        try {
          area.setSelectionRange(completion.start, end)
          if (document.execCommand('insertText', false, item) !== true) throw new Error('refused')
        } catch {
          const next = `${area.value.slice(0, completion.start)}${item}${area.value.slice(end)}`
          area.value = next
          onInput(next)
          const position = completion.start + item.length
          try {
            area.setSelectionRange(position, position)
          } catch {
            /* the element may be gone */
          }
        }
        setCompletion(undefined)
        setCaret(completion.start + item.length)
      }

      const openFinder = mode => {
        setFinder(previous => ({ ...previous, open: true, mode, index: 0 }))
      }

      /** Insert at the caret through the browser so the native undo stack survives. */
      const insertAt = (area, snippet, caretOffset) => {
        const start = area.selectionStart
        let done = false
        try {
          done = document.execCommand('insertText', false, snippet)
        } catch {
          done = false
        }
        if (!done) {
          const next = `${area.value.slice(0, start)}${snippet}${area.value.slice(area.selectionEnd)}`
          area.value = next
          onInput(next)
        }
        if (caretOffset !== undefined) {
          const position = start + caretOffset
          try {
            area.setSelectionRange(position, position)
          } catch {
            /* the element may already be gone */
          }
        }
      }

      const handleKeyDown = event => {
        if (completion !== undefined && !event.metaKey && !event.ctrlKey && !event.altKey) {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            const delta = event.key === 'ArrowDown' ? 1 : -1
            setCompletion(previous => ({
              ...previous,
              index: Math.min(
                Math.max(0, (previous.index ?? 0) + delta),
                previous.items.length - 1,
              ),
            }))
            return
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault()
            acceptCompletion()
            return
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setCompletion(undefined)
            return
          }
        }
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
        if ((event.metaKey || event.ctrlKey) && (event.key === 'f' || event.key === 'F')) {
          event.preventDefault()
          openFinder('find')
          return
        }
        if ((event.metaKey || event.ctrlKey) && (event.key === 'g' || event.key === 'G')) {
          event.preventDefault()
          openFinder('goto')
          return
        }
        if (event.key === 'Escape' && finder.open) {
          event.preventDefault()
          setFinder(previous => ({ ...previous, open: false }))
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
        const area = event.currentTarget
        const start = area.selectionStart
        const end = area.selectionEnd
        const plain = !event.metaKey && !event.ctrlKey && !event.altKey
        if (plain && event.key === 'Enter' && start === end && !event.shiftKey) {
          // Keep the indentation of the line being split, like an editor.
          const before = area.value.slice(0, start)
          const lineStart = before.lastIndexOf('\n') + 1
          const leading = /^[ \t]*/.exec(before.slice(lineStart))
          const indent = leading === null ? '' : leading[0]
          if (indent !== '') {
            event.preventDefault()
            insertAt(area, `\n${indent}`, indent.length + 1)
            return
          }
        }
        if (plain && (event.key === '{' || event.key === '[' || event.key === '(')) {
          // Auto-close, wrapping a selection instead of replacing it.
          const closer = event.key === '{' ? '}' : event.key === '[' ? ']' : ')'
          event.preventDefault()
          const selected = area.value.slice(start, end)
          insertAt(area, `${event.key}${selected}${closer}`,
            selected === '' ? 1 : selected.length + 2)
          return
        }
        if (plain && (event.key === '}' || event.key === ']' || event.key === ')')
          && start === end && area.value[start] === event.key) {
          // Step over a closer that is already there.
          event.preventDefault()
          try {
            area.setSelectionRange(start + 1, start + 1)
          } catch {
            /* the element may already be gone */
          }
          setCaret(start + 1)
          return
        }
        if (plain && event.key === 'Backspace' && start === end && start > 0) {
          const before = area.value[start - 1]
          const after = area.value[start]
          const pairs = { '{': '}', '[': ']', '(': ')' }
          if (pairs[before] === after) {
            event.preventDefault()
            const next = `${area.value.slice(0, start - 1)}${area.value.slice(start + 1)}`
            area.value = next
            onInput(next)
            try {
              area.setSelectionRange(start - 1, start - 1)
            } catch {
              /* the element may already be gone */
            }
            setCaret(start - 1)
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
      const currentMatch = matches.length === 0
        ? 0
        : Math.min(Math.max(0, finder.index), matches.length - 1) + 1
      const count = matches.length === 0
        ? (finder.query === '' ? '' : tr(t, 'findNoMatches'))
        : tr(t, 'findCount', { current: currentMatch, total: matches.length })

      const bar = []
      if (finder.open && finder.mode === 'goto') {
        bar.push(h('div', { className: 'prismlx-find', key: 'goto' }, [
          h('input', {
            key: 'line',
            ref: findRef,
            className: 'prismlx-find-input',
            type: 'text',
            inputMode: 'numeric',
            placeholder: tr(t, 'goToLine'),
            'aria-label': tr(t, 'goToLine'),
            onKeyDown: event => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setFinder(previous => ({ ...previous, open: false }))
                return
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                goToLine(event.currentTarget.value)
                setFinder(previous => ({ ...previous, open: false }))
              }
            },
          }),
          h('button', {
            type: 'button',
            className: 'prismlx-icon-button',
            key: 'close',
            'aria-label': tr(t, 'closeFind'),
            title: tr(t, 'closeFind'),
            onClick: () => setFinder(previous => ({ ...previous, open: false })),
          }, glyph('close', 14)),
        ]))
      } else if (finder.open) {
        const fields = [
          h('input', {
            key: 'query',
            ref: findRef,
            className: 'prismlx-find-input',
            type: 'text',
            placeholder: tr(t, 'findPlaceholder'),
            'aria-label': tr(t, 'findPlaceholder'),
            value: finder.query,
            onChange: event => setFinder(previous => ({
              ...previous,
              query: event.target.value,
              index: 0,
            })),
            onKeyDown: event => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setFinder(previous => ({ ...previous, open: false }))
                return
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                goToMatch((event.shiftKey ? finder.index - 1 : finder.index + 1) % Math.max(1, matches.length))
              }
            },
          }),
          h('span', { className: 'prismlx-find-count', key: 'count', role: 'status' }, count),
          h('button', {
            type: 'button',
            className: 'prismlx-icon-button',
            key: 'prev',
            'aria-label': tr(t, 'findPrevious'),
            title: tr(t, 'findPrevious'),
            disabled: matches.length === 0,
            onClick: () => goToMatch(finder.index - 1),
          }, glyph('up', 14)),
          h('button', {
            type: 'button',
            className: 'prismlx-icon-button',
            key: 'next',
            'aria-label': tr(t, 'findNext'),
            title: tr(t, 'findNext'),
            disabled: matches.length === 0,
            onClick: () => goToMatch(finder.index + 1),
          }, glyph('down', 14)),
          h('button', {
            type: 'button',
            className: 'prismlx-icon-button',
            key: 'replace-toggle',
            'aria-label': tr(t, 'toggleReplace'),
            title: tr(t, 'toggleReplace'),
            'aria-pressed': finder.replacing ? 'true' : 'false',
            onClick: () => setFinder(previous => ({ ...previous, replacing: !previous.replacing })),
          }, glyph('copy', 14)),
          h('button', {
            type: 'button',
            className: 'prismlx-icon-button',
            key: 'close',
            'aria-label': tr(t, 'closeFind'),
            title: tr(t, 'closeFind'),
            onClick: () => setFinder(previous => ({ ...previous, open: false })),
          }, glyph('close', 14)),
        ]
        bar.push(h('div', { className: 'prismlx-find', key: 'find' }, fields))
        if (finder.replacing) {
          bar.push(h('div', { className: 'prismlx-find prismlx-replace-row', key: 'replace' }, [
            h('input', {
              key: 'replacement',
              className: 'prismlx-find-input',
              type: 'text',
              placeholder: tr(t, 'replacePlaceholder'),
              'aria-label': tr(t, 'replacePlaceholder'),
              value: finder.replacement,
              onChange: event => setFinder(previous => ({ ...previous, replacement: event.target.value })),
              onKeyDown: event => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setFinder(previous => ({ ...previous, open: false }))
                }
                if (event.key === 'Enter') {
                  event.preventDefault()
                  replaceCurrent()
                }
              },
            }),
            h('button', {
              type: 'button',
              className: 'prismlx-find-action',
              key: 'one',
              disabled: matches.length === 0,
              onClick: replaceCurrent,
            }, tr(t, 'replaceOne')),
            h('button', {
              type: 'button',
              className: 'prismlx-find-action',
              key: 'all',
              disabled: matches.length === 0,
              onClick: replaceAll,
            }, tr(t, 'replaceAll')),
          ]))
        }
      }

      const section = activeSection >= 0 && activeSection < sections.length
        ? sections[activeSection]
        : undefined
      const popup = []
      if (completion !== undefined) {
        const area = areaRef.current
        const line = text.slice(0, completion.start).split('\n').length - 1
        const column = completion.start - (text.lastIndexOf('\n', completion.start - 1) + 1)
        const charWidth = measureCharWidth(size)
        const scrollTop = typeof area?.scrollTop === 'number' ? area.scrollTop : 0
        const scrollLeft = typeof area?.scrollLeft === 'number' ? area.scrollLeft : 0
        const height = typeof area?.clientHeight === 'number' ? area.clientHeight : 300
        const top = Math.max(0, Math.min(
          height - 40,
          10 + (line + 1) * (size * 1.62) - scrollTop,
        ))
        popup.push(h('div', {
          className: 'prismlx-complete',
          key: 'completion',
          role: 'listbox',
          'aria-label': tr(t, 'completionLabel'),
          style: {
            left: `${Math.max(8, 14 + column * charWidth - scrollLeft)}px`,
            top: `${top}px`,
          },
        }, completion.items.map((item, index) => h('div', {
          className: 'prismlx-complete-item',
          key: item,
          role: 'option',
          'aria-selected': index === (completion.index ?? 0) ? 'true' : 'false',
          'data-active': index === (completion.index ?? 0) ? 'true' : 'false',
          onMouseDown: event => {
            if (typeof event.preventDefault === 'function') event.preventDefault()
            acceptCompletion(index)
          },
        }, item))))
      }

      return h('div', {
        className: 'prismlx-editor-shell',
        style: { '--prism-code-size': `${size}px` },
      }, [
        ...bar,
        h('div', { className: 'prismlx-editor', key: 'editor' }, [
          h('div', { className: 'prismlx-gutter', key: 'gutter', ref: gutterRef, 'aria-hidden': 'true' },
            lines.map((_, index) => h('div', { key: index }, String(index + 1)))),
          h('div', { className: 'prismlx-editor-body', key: 'body' }, [
            h('pre', {
              className: 'prismlx-code-highlight',
              key: 'code',
              ref: codeRef,
              'aria-hidden': 'true',
              'data-hidden': composing ? 'true' : 'false',
            }, lines.map((line, index) => h('div', { className: 'prismlx-codeline', key: index },
              sourceLineNodes(line.length === 0 ? '' : line, highlighted?.[index], decorations.get(index))))),
            h('textarea', {
              className: 'prismlx-code-input',
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
              onScroll,
              onKeyDown: handleKeyDown,
              onCompositionStart: () => setComposing(true),
              onCompositionEnd: event => {
                setComposing(false)
                onInput(event.currentTarget.value)
              },
            }),
            section === undefined ? null : h('button', {
              className: 'prismlx-sticky',
              key: 'sticky',
              type: 'button',
              'aria-label': tr(t, 'jumpToSection', { title: section.title }),
              title: tr(t, 'jumpToSection', { title: section.title }),
              onClick: () => goToLine(section.line),
            }, [
              h('span', { key: 'level', className: 'prismlx-sticky-level' }, `§${section.level}`),
              h('span', { key: 'title', className: 'prismlx-sticky-text' }, section.title),
            ]),
            ...popup,
          ]),
        ]),
      ])
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
        /* fall through */
      }
      // No setDraft fallback: replacing the draft would discard whatever the user had
      // typed. A refused insert leaves the composer untouched instead.
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
    /** The client's own preference key for the session on screen. */
    const CURRENT_SESSION_KEY = 'dsh.sessions.current'
    /** Engines the Host knows how to drive, in the order the picker shows them. */
    const ENGINE_CHOICES = [
      { value: 'latexmk', label: 'latexmk' },
      { value: 'pdflatex', label: 'pdfLaTeX' },
      { value: 'xelatex', label: 'XeLaTeX' },
      { value: 'lualatex', label: 'LuaLaTeX' },
    ]
    const ENGINE_KEY = 'prism-latex.engine'
    const ENGINE_DEFAULT = 'latexmk'

    /** @returns the remembered engine, or the default when nothing valid is stored. */
    function readEngine() {
      try {
        const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(ENGINE_KEY)
        return ENGINE_CHOICES.some(choice => choice.value === raw) ? raw : ENGINE_DEFAULT
      } catch {
        return ENGINE_DEFAULT
      }
    }

    /** @param engine - chosen engine id; stored as preference. */
    function rememberEngine(engine) {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(ENGINE_KEY, engine)
      } catch {
        /* preference storage is best effort */
      }
    }

    /** Editor type size, remembered across files and reloads like an IDE. */
    const CODE_FONT_KEY = 'prism-latex.font'
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

    /** Split pane ratio, remembered per user like an IDE's split position. */
    const SPLIT_KEY = 'prism-latex.split'

    /** @returns the remembered source share of the split, clamped to 0.2–0.8. */
    function readSplitRatio() {
      try {
        const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(SPLIT_KEY)
        const parsed = Number.parseFloat(String(raw))
        if (!Number.isFinite(parsed)) return 0.5
        return Math.min(0.8, Math.max(0.2, parsed))
      } catch {
        return 0.5
      }
    }

    /** @param ratio - source share; stored clamped. */
    function rememberSplitRatio(ratio) {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(SPLIT_KEY, String(ratio))
      } catch {
        /* preference storage is best effort */
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

    /** Outline column width in px, remembered like an IDE's sidebar width. */
    const OUTLINE_WIDTH_KEY = 'prism-latex.outline-width'
    const OUTLINE_WIDTH_DEFAULT = 196
    const OUTLINE_WIDTH_MIN = 140
    const OUTLINE_WIDTH_MAX = 360

    /** @returns the next outline width, clamped to the supported range. */
    function clampOutlineWidth(value) {
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) return OUTLINE_WIDTH_DEFAULT
      return Math.min(OUTLINE_WIDTH_MAX, Math.max(OUTLINE_WIDTH_MIN, Math.round(parsed)))
    }

    /** @returns the remembered outline width, clamped to the supported range. */
    function readOutlineWidth() {
      try {
        const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(OUTLINE_WIDTH_KEY)
        const parsed = Number.parseInt(String(raw), 10)
        if (!Number.isFinite(parsed)) return OUTLINE_WIDTH_DEFAULT
        return clampOutlineWidth(parsed)
      } catch {
        return OUTLINE_WIDTH_DEFAULT
      }
    }

    /** @param width - next outline width in px; stored clamped. */
    function rememberOutlineWidth(width) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(OUTLINE_WIDTH_KEY, String(clampOutlineWidth(width)))
        }
      } catch {
        /* preference storage is best effort */
      }
    }

    /** Whether the outline column is shown; shown by default, like an IDE's sidebar. */
    const OUTLINE_OPEN_KEY = 'prism-latex.outline-open'

    /** @returns the remembered visibility of the outline column. */
    function readOutlineOpen() {
      try {
        const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(OUTLINE_OPEN_KEY)
        return raw !== 'hidden'
      } catch {
        return true
      }
    }

    /** @param open - whether the outline column is shown; stored best effort. */
    function rememberOutlineOpen(open) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(OUTLINE_OPEN_KEY, open ? 'open' : 'hidden')
        }
      } catch {
        /* preference storage is best effort */
      }
    }

    /** Whether the view's own preview column is shown; hidden by default. */
    const VIEW_PREVIEW_KEY = 'prism-latex.view-preview'

    /** @returns the remembered visibility of the view's preview column. */
    function readViewPreview() {
      try {
        const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(VIEW_PREVIEW_KEY)
        return raw === 'open'
      } catch {
        return false
      }
    }

    /** @param open - whether the preview column is shown; stored best effort. */
    function rememberViewPreview(open) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(VIEW_PREVIEW_KEY, open ? 'open' : 'hidden')
        }
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
      const target = useMemo(() => parseFileAddress(address ?? ''), [address])
      // An absolute address carries no session; the workspace root comes from the session
      // on screen.
      const sessionId = target?.sessionId ?? readCurrentSessionId()
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
      const [engine, setEngine] = useState(() => readEngine())
      const [jump, setJump] = useState(undefined)
      const [hint, setHint] = useState(undefined)
      const stateRef = useRef(state)
      stateRef.current = state
      const paneWidthRef = useRef(paneWidth)
      paneWidthRef.current = paneWidth

      // ⌘/Ctrl + = - 0 and ⌘/Ctrl + wheel zoom the page in this pane. The editor keeps the
      // same chords for its type size, so anything that starts in a text field is left alone.
      useEffect(() => {
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined
        const stepZoom = direction => {
          if (direction === 0) {
            setZoom('fit')
            return
          }
          const pages = stateRef.current.status === 'ready' ? stateRef.current.pages : undefined
          const width = paneWidthRef.current
          const fitScale = pages !== undefined && pages[0] !== undefined && width > 0
            ? fitScaleFor(width, pages[0])
            : 1
          setZoom(previous => nextZoomStep(previous, fitScale, direction) ?? previous)
        }
        const onKey = event => {
          const direction = zoomIntent(event)
          if (direction === undefined) return
          event.preventDefault()
          stepZoom(direction)
        }
        const onWheel = event => {
          if (!event.ctrlKey && !event.metaKey) return
          const target = event.target
          const root = target !== null && target !== undefined && typeof target.closest === 'function'
            ? target.closest('.prismlx-tabroot')
            : null
          if (root === null) return
          event.preventDefault()
          stepZoom(event.deltaY < 0 ? 1 : -1)
        }
        window.addEventListener('keydown', onKey)
        window.addEventListener('wheel', onWheel, { passive: false })
        return () => {
          window.removeEventListener('keydown', onKey)
          window.removeEventListener('wheel', onWheel)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      const [splitRatio, setSplitRatio] = useState(() => readSplitRatio())
      const splitRef = useRef(null)
      const ratioRef = useRef(splitRatio)
      ratioRef.current = splitRatio
      const rootRef = useRef(null)
      const urlsRef = useRef([])
      const draftRef = useRef(draft)
      draftRef.current = draft
      const sourceRef = useRef(source)
      sourceRef.current = source
      const savingRef = useRef(false)

      // A compile error hands the editor a line: show the source beside the page and put
      // the caret there.
      const jumpToSourceLine = (line, column) => {
        if (!Number.isFinite(Number(line))) return
        setMode(previous => (previous === 'split' ? previous : 'split'))
        const within = Number.isFinite(Number(column)) ? Math.max(0, Number(column)) : 0
        setJump(previous => ({ line: Number(line), column: within, seq: (previous?.seq ?? 0) + 1 }))
      }

      /**
       * Inverse search: the page pixel under the pointer becomes a PDF point, SyncTeX maps
       * it back to the source line, and the editor jumps there.
       */
      const inverseSearchAt = (index, event) => {
        const image = event?.currentTarget
        if (target === undefined || image === null || image === undefined) return
        const rect = typeof image.getBoundingClientRect === 'function' ? image.getBoundingClientRect() : undefined
        if (rect === undefined || rect.width <= 0 || rect.height <= 0) return
        const naturalWidth = Number(image.naturalWidth) > 0 ? Number(image.naturalWidth) : rect.width
        const naturalHeight = Number(image.naturalHeight) > 0 ? Number(image.naturalHeight) : rect.height
        const pixelX = (event.clientX - rect.left) * (naturalWidth / rect.width)
        const pixelY = (event.clientY - rect.top) * (naturalHeight / rect.height)
        const dpi = Number(state.dpi) > 0 ? Number(state.dpi) : 144
        const query = new URLSearchParams({
          session: sessionId ?? '',
          path: target.path,
          page: String(index + 1),
          x: (pixelX * 72 / dpi).toFixed(2),
          y: (pixelY * 72 / dpi).toFixed(2),
          engine,
        })
        fetch(`api/prism-latex/synctex?${query.toString()}`, { cache: 'no-store' })
          .then(async response => {
            let body
            try {
              body = await response.json()
            } catch {
              body = undefined
            }
            if (body?.ok !== true) {
              setHint(tr(t, 'synctexMiss'))
              setTimeout(() => setHint(undefined), 2400)
              return
            }
            if (body.path === target.path) {
              // Publish for the conversation view's editor, wherever it is mounted.
              publishJump({
                line: body.line,
                column: body.column,
                path: body.path,
                sessionId,
                debug: body.debug,
              })
              // This pane's own editor takes the caret too, when the page already sits beside
              // it. The mode is never touched, so a double-click cannot pull the preview into
              // a layout the user did not pick.
              if (mode === 'split' && source.status === 'ready') {
                const within = Number.isFinite(Number(body.column)) ? Math.max(0, Number(body.column)) : 0
                setJump(previous => ({
                  line: Number(body.line),
                  column: within,
                  seq: (previous?.seq ?? 0) + 1,
                }))
              }
              return
            }
            // The spot came from an \input or \include sibling: report where it is.
            setHint(tr(t, 'synctexElsewhere', { path: body.path, line: body.line }))
            setTimeout(() => setHint(undefined), 3200)
          })
          .catch(() => {
            setHint(tr(t, 'synctexMiss'))
            setTimeout(() => setHint(undefined), 2400)
          })
      }

      // The conversation view mirrors the document this sidebar tab shows.
      useEffect(() => {
        if (target === undefined) return
        publishDocument({ path: target.path, sessionId })
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [target?.path, sessionId])


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
        const query = new URLSearchParams({ session: sessionId, path: target.path })
        query.set('engine', engine)
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
      }, [target?.sessionId, target?.path, attempt, engine])

      // Source is read on demand: Source and Side by side fetch it once per file.
      useEffect(() => {
        if (mode === 'preview' || target === undefined) return undefined
        if (source.status === 'ready' && source.path === target.path) return undefined
        const controller = new AbortController()
        let cancelled = false
        setSource({ status: 'loading', path: target.path })
        const query = new URLSearchParams({ session: sessionId, path: target.path })
        fetch(`api/prism-latex/source?${query.toString()}`, {
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
        preview.push(h('div', { className: 'prismlx-center', key: 'invalid' },
          h('div', { className: 'prismlx-status', role: 'alert' }, tr(t, 'errorBadAddress'))))
      } else if (state.status === 'compiling' || state.status === 'idle') {
        preview.push(renderCompiling(t))
      } else if (state.status === 'error') {
        preview.push(renderError(t, state.error, {
          onRetry: () => setAttempt(value => value + 1),
          onJumpLine: jumpToSourceLine,
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
          onPageDoubleClick: inverseSearchAt,
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
        fetch('api/prism-latex/write', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            session: sessionId,
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

      const commitSplit = ratio => {
        ratioRef.current = ratio
        setSplitRatio(ratio)
        rememberSplitRatio(ratio)
      }

      const startSplitDrag = event => {
        const container = splitRef.current
        if (container === null || container === undefined) return
        if (typeof event.preventDefault === 'function') event.preventDefault()
        const rect = container.getBoundingClientRect()
        if (rect.width <= 0) return
        const target = event.currentTarget
        if (target !== null && target !== undefined && typeof target.setPointerCapture === 'function') {
          try {
            target.setPointerCapture(event.pointerId)
          } catch {
            /* capture is a nicety */
          }
        }
        if (typeof target === 'object' && target !== null) target.dataset.dragging = 'true'
        const move = moveEvent => {
          const ratio = Math.min(0.8, Math.max(0.2, (moveEvent.clientX - rect.left) / rect.width))
          ratioRef.current = ratio
          setSplitRatio(ratio)
        }
        const stop = () => {
          if (typeof target === 'object' && target !== null && target.dataset !== undefined) {
            target.dataset.dragging = 'false'
          }
          if (typeof window !== 'undefined') {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', stop)
            window.removeEventListener('pointercancel', stop)
          }
          rememberSplitRatio(ratioRef.current)
        }
        if (typeof window !== 'undefined') {
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', stop)
          window.addEventListener('pointercancel', stop)
        }
      }

      const nudgeSplit = event => {
        const step = event.shiftKey ? 0.1 : 0.02
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          commitSplit(Math.max(0.2, splitRatio - step))
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          commitSplit(Math.min(0.8, splitRatio + step))
        } else if (event.key === 'Home') {
          event.preventDefault()
          commitSplit(0.2)
        } else if (event.key === 'End') {
          event.preventDefault()
          commitSplit(0.8)
        }
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
          className: 'prismlx-banner',
          key: 'banner',
          role: 'alert',
        }, [
          h('span', { key: 'label' }, save.status === 'conflict'
            ? tr(t, 'conflict')
            : `${tr(t, 'saveFailed')}${save.message ? ` · ${save.message}` : ''}`),
          save.status === 'conflict'
            ? h('button', {
              type: 'button',
              className: 'prismlx-icon-button',
              key: 'reload',
              'aria-label': tr(t, 'reload'),
              title: tr(t, 'reload'),
              onClick: reloadSource,
            }, glyph('refresh', 15))
            : null,
        ]))
      }
      if (source.status === 'idle' || source.status === 'loading') {
        sourceChildren.push(h('div', { className: 'prismlx-center', key: 'source-loading', role: 'status' },
          h('div', { className: 'prismlx-status' }, tr(t, 'sourceLoading'))))
      } else if (source.status === 'error') {
        sourceChildren.push(h('div', { className: 'prismlx-center', key: 'source-error' },
          h('div', { className: 'prismlx-status', role: 'alert' },
            `${tr(t, 'sourceError')}${source.message ? ` · ${source.message}` : ''}`)))
      } else if (source.truncated === true) {
        const lines = source.text.split('\n')
        const highlighted = highlightLatexLines(source.text)
        sourceChildren.push(h('div', { className: 'prismlx-source', key: 'source-readonly' },
          lines.map((line, index) => h('div', { className: 'prismlx-srcline', key: index }, [
            h('span', { className: 'prismlx-lineno', key: 'n', 'aria-hidden': 'true' }, String(index + 1)),
            h('span', { className: 'prismlx-linetext', key: 't' },
              sourceLineNodes(line, highlighted?.[index])),
          ]))))
        sourceChildren.push(h('div', { className: 'prismlx-panel-note', key: 'source-cut' },
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
          jump,
        }))
      }

      const previewPane = h('div', {
        className: 'prismlx-pane',
        key: 'preview',
        'data-pane': 'preview',
        ref: node => { rootRef.current = node },
      }, state.refreshing === true
        ? [h('div', {
          className: 'prismlx-progress',
          key: 'progress',
          role: 'progressbar',
          'aria-label': tr(t, 'compiling'),
        }), ...preview]
        : preview)
      const sourcePane = h('div', {
        className: 'prismlx-pane',
        key: 'source',
        'data-pane': 'source',
        'data-editor': source.status === 'ready' && source.truncated !== true ? 'true' : 'false',
      }, sourceChildren)

      let body
      if (mode === 'preview') body = previewPane
      else if (mode === 'source') body = sourcePane
      else {
        body = h('div', {
          className: 'prismlx-split',
          key: 'split',
          ref: node => { splitRef.current = node },
          style: { '--prism-split': String(splitRatio) },
        }, [
          sourcePane,
          h('div', {
            className: 'prismlx-divider',
            key: 'divider',
            role: 'separator',
            'aria-orientation': 'vertical',
            'aria-label': tr(t, 'resizeSplit'),
            'aria-valuenow': Math.round(splitRatio * 100),
            'aria-valuemin': 20,
            'aria-valuemax': 80,
            tabIndex: 0,
            onPointerDown: startSplitDrag,
            onDoubleClick: () => commitSplit(0.5),
            onKeyDown: nudgeSplit,
          }),
          previewPane,
        ])
      }

      const status = compileStatus(t, state)
      const heading = typeof tab?.title === 'string' && tab.title !== ''
        ? tab.title
        : titleOfAddress(address)

      return h('div', { className: 'prismlx-tabroot' }, [
        h('style', { key: 'style' }, CSS),
        h('div', { className: 'prismlx-toolbar', key: 'toolbar' }, [
          h('div', { className: 'prismlx-tabmeta', key: 'meta' }, [
            h('span', {
              className: 'prismlx-dot',
              key: 'dot',
              'data-state': status.tone,
              'aria-hidden': 'true',
              title: tr(t, 'statusHint'),
            }),
            h('span', {
              className: 'prismlx-tabstatus',
              key: 'status',
              role: 'status',
              'aria-live': 'polite',
              title: hint === undefined ? heading : hint,
              'data-hint': hint === undefined ? 'false' : 'true',
            }, hint === undefined ? status.text : hint),
          ]),
          h('div', { className: 'prismlx-tabactions', key: 'actions' }, [
            h('select', {
              key: 'engine',
              className: 'prismlx-engine',
              'aria-label': tr(t, 'engineLabel'),
              title: tr(t, 'engineLabel'),
              value: engine,
              onChange: event => {
                const next = event.target.value
                setEngine(next)
                rememberEngine(next)
              },
            }, ENGINE_CHOICES.map(choice => h('option', {
              key: choice.value,
              value: choice.value,
            }, choice.label))),
            fontBadge === undefined
              ? null
              : h('span', { className: 'prismlx-zoombadge', key: 'font', role: 'status' }, fontBadge),
            dirty
              ? h('button', {
                type: 'button',
                className: 'prismlx-save-button',
                key: 'save',
                'aria-label': tr(t, 'saveHint'),
                title: tr(t, 'saveHint'),
                onClick: saveText,
              }, glyph('save', 14))
              : null,
            h('button', {
              type: 'button',
              className: 'prismlx-icon-button',
              key: 'compile',
              'aria-label': tr(t, 'compile'),
              title: tr(t, 'compile'),
              onClick: compileNow,
              disabled: save.status === 'saving',
            }, glyph('play', 15)),
          ]),
          h('div', {
            className: 'prismlx-modes',
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
     * The LaTeX conversation view: the source of the document the right sidebar is showing,
     * beside the Outline column, with an optional preview of the compiled page.
     */
    function LatexPanel(props) {
      const t = typeof props.t === 'function' ? props.t : boundT
      const [attempt, setAttempt] = useState(0)
      const [selected, setSelected] = useState(undefined)
      // The session of the document published by the right sidebar; the app's current
      // session is only the fallback for when nothing has been published yet.
      const [documentSession, setDocumentSession] = useState(undefined)
      const [renderState, setRenderState] = useState({ status: 'idle' })
      const [zoom, setZoom] = useState('fit')
      const [download, setDownload] = useState({ status: 'idle' })
      const [paneWidth, setPaneWidth] = useState(0)
      const [copied, setCopied] = useState(false)
      // The Outline column is the only list this view owns; the document comes from the
      // right sidebar, and the editor sits beside the outline.
      const [outlineWidth, setOutlineWidth] = useState(() => readOutlineWidth())
      const [outlineOpen, setOutlineOpen] = useState(() => readOutlineOpen())
      // The view's own preview is optional: the right sidebar already shows the page most
      // of the time, so this column starts hidden and the editor gets the space.
      const [preview, setPreview] = useState(() => readViewPreview())
      const [source, setSource] = useState({ status: 'idle' })
      const [draft, setDraft] = useState(undefined)
      const [pendingJump, setPendingJump] = useState(undefined)
      const renderStateRef = useRef(renderState)
      renderStateRef.current = renderState
      const paneWidthRef = useRef(paneWidth)
      paneWidthRef.current = paneWidth

      // The preview column answers ⌘/Ctrl + wheel and ⌘/Ctrl + = - 0 as well. Only events over
      // the pages zoom; the editor and the outline keep their own behaviour.
      useEffect(() => {
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined
        const stepZoom = direction => {
          if (direction === 0) {
            setZoom('fit')
            return
          }
          const pages = renderStateRef.current.status === 'ready' ? renderStateRef.current.pages : undefined
          const fitScale = pages !== undefined && pages[0] !== undefined && paneWidthRef.current > 0
            ? fitScaleFor(paneWidthRef.current, pages[0])
            : 1
          setZoom(previous => nextZoomStep(previous, fitScale, direction) ?? previous)
        }
        const overPreview = event => {
          const target = event.target
          if (target === null || target === undefined || typeof target.closest !== 'function') return false
          return target.closest('.prismlx-panel-doc') !== null
        }
        const onWheel = event => {
          if (!event.ctrlKey && !event.metaKey) return
          if (!overPreview(event)) return
          event.preventDefault()
          stepZoom(event.deltaY < 0 ? 1 : -1)
        }
        const onKey = event => {
          if (!overPreview(event)) return
          const direction = zoomIntent(event)
          if (direction === undefined) return
          event.preventDefault()
          stepZoom(direction)
        }
        window.addEventListener('wheel', onWheel, { passive: false })
        window.addEventListener('keydown', onKey)
        return () => {
          window.removeEventListener('wheel', onWheel)
          window.removeEventListener('keydown', onKey)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      // Section index the editor reports, tagged with the document it belongs to so a stale
      // index never highlights a row in another file.
      const [activeSection, setActiveSection] = useState(undefined)
      const [codeFont, setCodeFont] = useState(() => readCodeFont())
      // Height of the shell's composer where it overlaps this view; 0 when it does not.
      const [composerInset, setComposerInset] = useState(0)
      const docRef = useRef(null)
      const rootRef = useRef(null)
      const outlineRef = useRef(null)
      const urlsRef = useRef([])
      const timersRef = useRef([])
      const sessionId = documentSession ?? readCurrentSessionId()
      // The jump subscription is registered once; these refs keep it reading the current
      // selection instead of whatever was selected when it mounted.
      const selectedRef = useRef(selected)
      selectedRef.current = selected
      const sessionRef = useRef(sessionId)
      sessionRef.current = sessionId
      const outlineWidthRef = useRef(outlineWidth)
      outlineWidthRef.current = outlineWidth

      useEffect(() => {
        if (preview !== true) {
          // A collapsed preview does not compile. Keep the last finished state for this
          // document so the header pill reports what really happened, but never keep a
          // "compiling" state that this collapse just aborted, nor a state from another file.
          setRenderState(previous => (previous.status === 'compiling' || previous.path !== selected
            ? { status: 'idle' }
            : previous))
          return undefined
        }
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
        setRenderState({ status: 'compiling', path: selected })
        const query = new URLSearchParams({ session: sessionId, path: selected })
        query.set('engine', readEngine())
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
              setRenderState({
                status: 'error',
                error: { code: 'bad-response', message: `HTTP ${response.status}` },
                path: selected,
              })
              return
            }
            if (body.ok !== true) {
              setRenderState({ status: 'error', error: body.error ?? { code: 'bad-request' }, path: selected })
              return
            }
            const pages = []
            for (const page of Array.isArray(body.pages) ? body.pages : []) {
              let url
              try {
                url = URL.createObjectURL(new Blob([base64ToBytes(page?.png)], { type: 'image/png' }))
              } catch {
                setRenderState({ status: 'error', error: { code: 'bad-response' }, path: selected })
                return
              }
              created.push(url)
              pages.push({ url, width: Number(page?.width) || 0, height: Number(page?.height) || 0 })
            }
            if (pages.length === 0) {
              setRenderState({ status: 'error', error: { code: 'no-pages' }, path: selected })
              return
            }
            const stale = urlsRef.current
            urlsRef.current = pages.map(page => page.url)
            setRenderState({
              status: 'ready',
              path: selected,
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
              path: selected,
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
      }, [preview, sessionId, selected, attempt])

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
        if (preview !== true || node === null || node === undefined) return undefined
        const measure = () => setPaneWidth(node.clientWidth)
        measure()
        if (typeof ResizeObserver === 'function') {
          const observer = new ResizeObserver(measure)
          observer.observe(node)
          return () => observer.disconnect()
        }
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
      }, [preview])

      // One subscription: a page double-click anywhere in this plugin instance lands the
      // caret here, in the file the jump names. A jump never changes the layout.
      useEffect(() => subscribeJump(jump => {
        if (jump === null || jump === undefined || !Number.isFinite(jump.line)) return
        const session = sessionRef.current
        if (session !== undefined && jump.sessionId !== undefined && jump.sessionId !== session) return
        traceJump('receive', { line: jump.line, path: jump.path, selected: selectedRef.current })
        if (selectedRef.current !== jump.path) setSelected(jump.path)
        // `path` is what lets the editor accept the jump: the prop is only handed over when
        // the pending jump names the file the editor holds. Dropping it here made every
        // double-click publish and receive and then do nothing at all.
        setPendingJump({
          line: jump.line,
          column: jump.column ?? 0,
          seq: jump.at ?? Date.now(),
          path: jump.path,
        })
      }), [])

      // The view's document is whatever the right sidebar is showing; when nothing has been
      // published yet it keeps whatever it had.
      useEffect(() => subscribeDocument(document => {
        if (document === null || document === undefined) return
        if (typeof document.path !== 'string' || document.path === '') return
        setSelected(document.path)
        if (document.sessionId !== undefined) setDocumentSession(document.sessionId)
      }), [])

      const documentName = selected === undefined ? undefined : (() => {
        const parts = selected.split('/')
        return parts[parts.length - 1]
      })()
      const heading = documentName === undefined ? tr(t, 'panelNoDocument') : documentName

      // Source is read on demand, once per file, and kept while the panel stays open.
      useEffect(() => {
        if (sessionId === undefined || selected === undefined) return undefined
        // A jump belongs to the file it landed in; never replay it in another document.
        if (pendingJump !== undefined && pendingJump.path !== selected) setPendingJump(undefined)
        if (source.status === 'ready' && source.path === selected) return undefined
        // A draft belongs to the file it was typed in; never carry it into another file.
        if (draft !== undefined) setDraft(undefined)
        const controller = new AbortController()
        let cancelled = false
        setSource({ status: 'loading', path: selected })
        const query = new URLSearchParams({ session: sessionId, path: selected })
        fetch(`api/prism-latex/source?${query.toString()}`, {
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
            if (body?.ok !== true) {
              setSource({
                status: 'error',
                path: selected,
                message: body?.error?.message ? String(body.error.message) : `HTTP ${response.status}`,
              })
              return
            }
            setSource({
              status: 'ready',
              path: selected,
              text: typeof body.text === 'string' ? body.text : '',
              version: typeof body.version === 'string' ? body.version : '',
              truncated: body.truncated === true,
            })
          })
          .catch(error => {
            if (cancelled || error?.name === 'AbortError') return
            setSource({ status: 'error', path: selected, message: error?.message ? String(error.message) : '' })
          })
        return () => {
          cancelled = true
          controller.abort()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [sessionId, selected])

      const saveSourceFile = () => {
        if (draft === undefined || sessionId === undefined || selected === undefined) return
        const text = draft
        setDraft(undefined)
        setSource(previous => ({ ...previous, text }))
        fetch('api/prism-latex/write', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ session: sessionId, path: selected, text, expectedVersion: source.version }),
        })
          .then(async response => {
            let body
            try {
              body = await response.json()
            } catch {
              body = undefined
            }
            if (body?.ok === true) {
              setSource(previous => ({ ...previous, text, version: String(body.version ?? '') }))
              setAttempt(value => value + 1)
              return
            }
            // Keep the edit so nothing is lost when the write is refused.
            setDraft(text)
          })
          .catch(() => setDraft(text))
      }

      const outline = source.status === 'ready' ? collectSections(source.text) : []
      // Only an index reported for the document on screen and still inside the current
      // Outline may mark a row; a shorter file, a stale index or another path means none.
      const activeOutlineIndex = activeSection !== undefined
        && activeSection.path === selected
        && Number.isFinite(activeSection.index)
        && activeSection.index >= 0
        && activeSection.index < outline.length
        ? activeSection.index
        : -1
      // A long Outline scrolls its own box, so the marked row can sit outside it and the
      // rail stops saying where you are. Nudge only that box, and only when the row is
      // out of sight: the editor's scroll must never move it, and neither must the user's.
      useEffect(() => {
        const box = outlineRef.current
        if (box === null || box === undefined) return
        const row = typeof box.querySelector === 'function' ? box.querySelector('[data-active="true"]') : undefined
        if (row === null || row === undefined) return
        const top = row.offsetTop
        const bottom = top + row.offsetHeight
        if (top < box.scrollTop) box.scrollTop = top
        else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight
      }, [activeOutlineIndex])
      const sourceLine = idx => {
        if (source.status !== 'ready') return
        // Mark the target immediately: the jump scrolls the editor and its callback then
        // confirms the same row, but the old row must not stay lit in between.
        setActiveSection({ path: selected, index: idx })
        setPendingJump({ line: outline[idx].line, seq: Date.now(), path: selected })
      }

      /**
       * Inverse search: the page pixel under the pointer becomes a PDF point, SyncTeX maps
       * it back to the source line, and the already-mounted editor takes the caret there.
       * Nothing about the layout changes: both columns were on screen to begin with.
       */
      const inverseSearchAt = (index, event) => {
        const image = event?.currentTarget
        if (sessionId === undefined || selected === undefined) return
        if (image === null || image === undefined) return
        const rect = typeof image.getBoundingClientRect === 'function' ? image.getBoundingClientRect() : undefined
        if (rect === undefined || rect.width <= 0 || rect.height <= 0) return
        const naturalWidth = Number(image.naturalWidth) > 0 ? Number(image.naturalWidth) : rect.width
        const naturalHeight = Number(image.naturalHeight) > 0 ? Number(image.naturalHeight) : rect.height
        const pixelX = (event.clientX - rect.left) * (naturalWidth / rect.width)
        const pixelY = (event.clientY - rect.top) * (naturalHeight / rect.height)
        const dpi = Number(renderState.dpi) > 0 ? Number(renderState.dpi) : 144
        const query = new URLSearchParams({
          session: sessionId,
          path: selected,
          page: String(index + 1),
          x: (pixelX * 72 / dpi).toFixed(2),
          y: (pixelY * 72 / dpi).toFixed(2),
          engine: readEngine(),
        })
        fetch(`api/prism-latex/synctex?${query.toString()}`, { cache: 'no-store' })
          .then(async response => {
            let body
            try {
              body = await response.json()
            } catch {
              body = undefined
            }
            if (body?.ok !== true || typeof body.line !== 'number') return
            // The hit must belong to the file this page is showing; a sibling reached
            // through \input would otherwise put the caret on the wrong line.
            if (body.path !== selected) return
            setPendingJump({
              line: body.line,
              column: body.column ?? 0,
              seq: Date.now(),
              path: selected,
            })
            publishJump({ line: body.line, column: body.column, path: body.path, sessionId, debug: body.debug })
          })
          .catch(() => {})
      }

      const commitOutlineWidth = width => {
        const next = clampOutlineWidth(width)
        outlineWidthRef.current = next
        setOutlineWidth(next)
        rememberOutlineWidth(next)
      }

      /** Drag the outline/editor divider: the pointer delta becomes the outline's pixels. */
      const startOutlineDrag = event => {
        if (typeof event.preventDefault === 'function') event.preventDefault()
        const startX = Number(event.clientX)
        if (!Number.isFinite(startX)) return
        const startWidth = outlineWidthRef.current
        const target = event.currentTarget
        if (target !== null && target !== undefined && typeof target.setPointerCapture === 'function') {
          try {
            target.setPointerCapture(event.pointerId)
          } catch {
            /* capture is a nicety */
          }
        }
        if (typeof target === 'object' && target !== null) target.dataset.dragging = 'true'
        const move = moveEvent => {
          const clientX = Number(moveEvent.clientX)
          if (!Number.isFinite(clientX)) return
          const next = clampOutlineWidth(startWidth + (clientX - startX))
          outlineWidthRef.current = next
          setOutlineWidth(next)
        }
        const stop = () => {
          if (typeof target === 'object' && target !== null && target.dataset !== undefined) {
            target.dataset.dragging = 'false'
          }
          if (typeof window !== 'undefined') {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', stop)
            window.removeEventListener('pointercancel', stop)
          }
          rememberOutlineWidth(outlineWidthRef.current)
        }
        if (typeof window !== 'undefined') {
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', stop)
          window.addEventListener('pointercancel', stop)
        }
      }

      const nudgeOutlineWidth = event => {
        const step = event.shiftKey ? 40 : 10
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          commitOutlineWidth(outlineWidth - step)
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          commitOutlineWidth(outlineWidth + step)
        } else if (event.key === 'Home') {
          event.preventDefault()
          commitOutlineWidth(OUTLINE_WIDTH_MIN)
        } else if (event.key === 'End') {
          event.preventDefault()
          commitOutlineWidth(OUTLINE_WIDTH_MAX)
        }
      }

      const toggleOutline = () => {
        setOutlineOpen(open => {
          const next = open !== true
          rememberOutlineOpen(next)
          return next
        })
      }

      const togglePreview = () => {
        setPreview(open => {
          const next = open !== true
          rememberViewPreview(next)
          return next
        })
      }

      /** The header status pill opens the preview; it never hides it. */
      const showPreview = () => {
        setPreview(true)
        rememberViewPreview(true)
      }

      const editor = []
      if (source.status === 'ready' && source.path === selected && source.truncated !== true) {
        editor.push(h(SourceEditor, {
          key: `editor:${selected}`,
          t,
          text: draft === undefined ? source.text : draft,
          resetToken: source.version,
          onInput: value => setDraft(value),
          onSave: saveSourceFile,
          onCompile: saveSourceFile,
          onActiveSection: index => setActiveSection({ path: selected, index }),
          jump: pendingJump !== undefined && pendingJump.path === selected ? pendingJump : undefined,
          fontSize: codeFont,
          onZoom: delta => {
            const next = delta === 0
              ? CODE_FONT_DEFAULT
              : Math.min(CODE_FONT_MAX, Math.max(CODE_FONT_MIN, codeFont + delta))
            setCodeFont(next)
            rememberCodeFont(next)
          },
        }))
      } else {
        editor.push(h('div', { className: 'prismlx-panel-note', key: 'source-state' },
          selected === undefined
            ? tr(t, 'panelNoDocument')
            : source.status === 'error'
              ? `${tr(t, 'sourceError')}${source.message ? ` · ${source.message}` : ''}`
              : source.truncated === true ? tr(t, 'readOnlyTooLarge') : tr(t, 'sourceLoading')))
      }

      const dirty = draft !== undefined && source.status === 'ready' && draft !== source.text

      const pill = renderState.status === 'ready'
        ? {
          tone: 'ready',
          label: tr(t, 'panelStatusReady'),
          detail: (() => {
            const count = Number(renderState.pageCount) > 0
              ? Number(renderState.pageCount)
              : (Array.isArray(renderState.pages) ? renderState.pages.length : 0)
            if (!(count > 0)) return ''
            return tr(t, count === 1 ? 'panelStatusPageOne' : 'panelStatusPages', { count })
          })(),
        }
        : renderState.status === 'compiling'
          ? { tone: 'compiling', label: tr(t, 'statusCompiling'), detail: '' }
          : renderState.status === 'error'
            ? { tone: 'error', label: tr(t, 'statusError'), detail: '' }
            : { tone: 'idle', label: tr(t, 'panelStatusIdle'), detail: '' }

      // No document at all: the columns would be empty shells, so the body becomes one
      // calm note instead. A known document whose source is loading keeps the small note.
      const empty = selected === undefined

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
          onPageDoubleClick: inverseSearchAt,
        }))
      } else {
        doc.push(h('div', { className: 'prismlx-panel-note', key: 'intro' }, tr(t, 'panelIntro')))
      }

      /**
       * Fill the shell's viewport instead of growing with the document.
       *
       * The panel sits in a `overflow: auto` body with no definite height, so `height: 100%`
       * resolves to `auto`: the editor's height pushed the panel to its content height and the
       * shell then scrolled the whole view — header, outline and composer alike. Measuring the
       * scrolling ancestor and pinning that many pixels keeps every column fixed and gives the
       * editor its own scrollbar.
       */
      const scrollHost = node => {
        let parent = node === null || node === undefined ? undefined : node.parentElement
        for (let depth = 0; parent !== undefined && parent !== null && depth < 12; depth += 1) {
          const style = typeof getComputedStyle === 'function' ? getComputedStyle(parent) : undefined
          const overflow = style?.overflowY ?? ''
          if ((overflow === 'auto' || overflow === 'scroll')
            && Number(parent.scrollHeight) > Number(parent.clientHeight) + 1) {
            return parent
          }
          parent = parent.parentElement
        }
        return undefined
      }
      const [paneHeight, setPaneHeight] = useState(0)
      /**
       * The shell's composer seat, when it is mounted near this view. The search is bounded
       * to a few ancestors so a split view never picks up another session's composer.
       */
      const composerSeatOf = anchor => {
        let scope = anchor
        for (let depth = 0; scope !== undefined && scope !== null && depth < 4; depth += 1) {
          if (typeof scope.querySelector === 'function') {
            const seat = scope.querySelector('[data-composer-seat]')
            if (seat !== null) return seat
          }
          scope = scope.parentElement
        }
        return undefined
      }
      const measurePane = () => {
        const node = rootRef.current
        if (node === null || node === undefined || typeof node.getBoundingClientRect !== 'function') return
        const host = scrollHost(node)
        const rect = node.getBoundingClientRect()
        let next = 0
        // The panel is pinned to this line, so both branches report the bottom it fills to.
        let bottom = rect.bottom
        if (host !== undefined) {
          bottom = host.getBoundingClientRect().bottom
          next = Math.round(bottom - rect.top)
        } else if (typeof window !== 'undefined' && Number(window.innerHeight) > 0) {
          next = Math.max(320, Math.round(window.innerHeight - rect.top - 96))
          bottom = rect.top + next
        }
        if (next > 0) setPaneHeight(previous => (previous === next ? previous : next))
        /* The shell's composer can ride over the view's bottom edge, where it hides the
         * editor's last lines and any caret a jump puts there. Reserve exactly the covered
         * height. When the composer is laid out below the view, or the seat is hidden, no
         * box of positive height sits above that line and the inset stays 0. */
        let inset = 0
        const seat = host === undefined ? undefined : composerSeatOf(host)
        const seatRect = seat === null || seat === undefined ? undefined : seat.getBoundingClientRect()
        if (seatRect !== undefined && seatRect.height > 0 && seatRect.top < bottom) {
          inset = Math.min(240, Math.max(0, Math.round(bottom - seatRect.top)))
        }
        setComposerInset(previous => (previous === inset ? previous : inset))
      }
      useEffect(() => {
        const node = rootRef.current
        if (node === null || node === undefined) return undefined
        let observer
        if (typeof ResizeObserver === 'function') {
          observer = new ResizeObserver(() => measurePane())
        }
        const host = scrollHost(node)
        const seat = composerSeatOf(host ?? node)
        if (observer !== undefined) {
          observer.observe(host ?? node)
          // A composer that grows (a wrapped draft, an attachment row) moves the inset.
          if (seat !== null && seat !== undefined) observer.observe(seat)
          if (typeof document !== 'undefined' && document.body !== null) observer.observe(document.body)
        }
        const frame = typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame(measurePane)
          : (measurePane(), 0)
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          window.addEventListener('resize', measurePane)
        }
        return () => {
          if (typeof cancelAnimationFrame === 'function' && frame !== 0) cancelAnimationFrame(frame)
          if (observer !== undefined) observer.disconnect()
          if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener('resize', measurePane)
          }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      return h('div', {
        className: 'prismlx-panel',
        ref: node => { rootRef.current = node },
        style: paneHeight > 0
          ? {
            height: `${paneHeight}px`,
            maxHeight: `${paneHeight}px`,
            '--prism-composer-inset': `${composerInset}px`,
          }
          : undefined,
      }, [
        h('style', { key: 'style' }, CSS),
        h('div', { className: 'prismlx-panel-head', key: 'head' }, [
          h('div', { className: 'prismlx-panel-heading', key: 'heading' }, [
            h('div', { className: 'prismlx-panel-title', key: 'title' }, tr(t, 'panelTitle')),
            h('div', {
              className: 'prismlx-panel-sub',
              key: 'sub',
              // The build string is a debugging fact: keep it in the tooltip, not in the way.
              title: `${heading}  ·  ${CLIENT_BUILD}`,
            }, [
              documentName === undefined
                ? null
                : h('span', { key: 'name', className: 'prismlx-panel-doc-name' }, heading),
              dirty
                ? h('span', {
                  key: 'dirty',
                  className: 'prismlx-panel-dirty',
                  role: 'status',
                  title: tr(t, 'panelDirty'),
                  'aria-label': tr(t, 'panelDirty'),
                })
                : null,
              outline.length === 0
                ? null
                : h('span', { key: 'count', className: 'prismlx-panel-count' },
                  tr(t, 'panelSectionCount', { count: outline.length })),
            ]),
          ]),
          // Before anything has compiled there is no state to report: an `Idle` pill only
          // competes with the document name for the second slot in the header. The pill
          // appears with the first compile, then tracks the real state.
          preview !== true && pill.tone !== 'idle'
            ? h('button', {
              type: 'button',
              className: 'prismlx-panel-status',
              key: 'status-pill',
              'data-tone': pill.tone,
              role: 'status',
              'aria-live': 'polite',
              'aria-label': pill.detail === '' ? pill.label : `${pill.label} · ${pill.detail}`,
              title: tr(t, 'panelStatusHint', { state: pill.label }),
              onClick: showPreview,
            }, [
              h('span', { key: 'dot', className: 'prismlx-panel-status-dot', 'aria-hidden': 'true' }),
              h('span', { key: 'label', className: 'prismlx-panel-status-label' }, pill.label),
              pill.detail === ''
                ? null
                : h('span', { key: 'detail', className: 'prismlx-panel-status-detail' }, pill.detail),
            ])
            : null,
          h('button', {
            type: 'button',
            className: 'prismlx-icon-button',
            key: 'outline-toggle',
            'aria-label': tr(t, outlineOpen ? 'outlineHide' : 'outlineShow'),
            title: tr(t, outlineOpen ? 'outlineHide' : 'outlineShow'),
            'aria-pressed': outlineOpen ? 'true' : 'false',
            onClick: toggleOutline,
          }, glyph('outline', 15)),
          h('button', {
            type: 'button',
            className: 'prismlx-icon-button',
            key: 'preview-toggle',
            'aria-label': tr(t, preview ? 'viewPreviewHide' : 'viewPreviewShow'),
            title: tr(t, preview ? 'viewPreviewHide' : 'viewPreviewShow'),
            'aria-pressed': preview ? 'true' : 'false',
            onClick: togglePreview,
          }, glyph('eye', 15)),
        ]),
        empty
          ? h('div', { className: 'prismlx-panel-blank', key: 'empty' }, [
            h('div', { className: 'prismlx-panel-blank-title', key: 'title' }, tr(t, 'panelNoDocument')),
            h('div', { className: 'prismlx-panel-blank-hint', key: 'hint' }, tr(t, 'panelEmptyHint')),
          ])
          : h('div', {
            className: 'prismlx-workspace',
            key: 'workspace',
            style: { '--prism-outline-width': `${outlineWidth}px` },
            'data-outline': outlineOpen ? 'true' : 'false',
            'data-preview': preview ? 'true' : 'false',
          }, [
            outlineOpen
              ? h('div', {
                className: 'prismlx-outline',
                key: 'outline',
                role: 'navigation',
                ref: node => { outlineRef.current = node },
              }, [
                h('div', { className: 'prismlx-outline-title', key: 'label' }, tr(t, 'outlineLabel')),
                outline.length === 0
                  ? h('div', { className: 'prismlx-outline-empty', key: 'empty' }, tr(t, 'outlineEmpty'))
                  : outline.map((entry, index) => h('button', {
                    type: 'button',
                    key: `${entry.line}:${entry.title}`,
                    className: 'prismlx-outline-row',
                    style: { paddingLeft: `${(entry.level - 3) * 12 + 10}px` },
                    title: entry.title,
                    'data-level': String(entry.level),
                    'aria-current': activeOutlineIndex === index ? 'true' : undefined,
                    'data-active': activeOutlineIndex === index ? 'true' : 'false',
                    onClick: () => sourceLine(index),
                  }, [
                    h('span', { key: 'rail', className: 'prismlx-outline-rail', 'aria-hidden': 'true' }),
                    h('span', { key: 'text', className: 'prismlx-outline-text' }, entry.title),
                  ])),
              ])
              : null,
            outlineOpen
              ? h('div', {
                className: 'prismlx-divider',
                key: 'outline-divider',
                role: 'separator',
                'aria-orientation': 'vertical',
                'aria-label': tr(t, 'resizeOutline'),
                'aria-valuenow': outlineWidth,
                'aria-valuemin': OUTLINE_WIDTH_MIN,
                'aria-valuemax': OUTLINE_WIDTH_MAX,
                tabIndex: 0,
                onPointerDown: startOutlineDrag,
                onDoubleClick: () => commitOutlineWidth(OUTLINE_WIDTH_DEFAULT),
                onKeyDown: nudgeOutlineWidth,
              })
              : null,
            h('div', {
              className: 'prismlx-editor-pane',
              key: 'editor',
              'data-pane': 'source',
            }, editor),
            preview
              ? h('div', { className: 'prismlx-panel-doc', key: 'doc', ref: node => { docRef.current = node } }, doc)
              : null,
          ]),
      ])
    }

    function apply(ctx) {
      // English-only copy: this pane is an IDE-style tool, and the words are kept
      // deliberately terse. The locale chain falls back to `en` for every language.
      ctx.effect(() => ctx.locale.register('prismLatex', { en }))
      const t = ctx.locale.bind('prismLatex')
      boundT = t

      const definition = {
        id: 'prism-latex',
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

      // A Conversation view: the shell draws the view tabs and the native composer around it,
      // so this is the surface that gets the real input box without re-implementing chat.
      const ConvView = props => h(LatexPanel, props)
      ctx.effect(() => ctx.slots.inject('conversation.view', () => ctx.slots.register({
        name: 'conversation.view',
        id: 'prism-latex',
        order: 40,
        locale: 'prismLatex',
        label: () => t('panelTitle'),
      }, function GuardedConvView(props) {
        try {
          return ConvView(props)
        } catch (error) {
          lastClientError = {
            message: String(error?.message ?? error),
            stack: String(error?.stack ?? '').slice(0, 1200),
            at: Date.now(),
          }
          return React.createElement('div', {
            style: {
              padding: '12px',
              color: '#f85149',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
            },
          }, `LaTeX view failed: ${String(error?.message ?? error)}`)
        }
      })))

      ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
        name: 'sidebar.right.tab.document',
        key: 'prism-latex',
        locale: 'prismLatex',
      }, LatexBody)))

      // The right sidebar: a tab type of our own claims every LaTeX document, so the
      // pane renders the compiled file the moment it is opened. This is the primary
      // surface — the document-preview renderer above is a fallback for compositions
      // whose preview package offers the registry.
      let tabTypeState = 'unknown'
      let tabTypeError = ''
      let disposeTabType
      /** How often the watchdog had to put the type back after it disappeared. */
      let tabTypeRecovered = 0
      // Whole-address patterns: a plain `*.tex` loses the extension-band tie to a broader
      // file type (`dsh-resource://file/**`), because the ranking compares matched pattern
      // length. These out-specify it and still restrict by suffix through `canOpen`.
      const tabDefinition = {
        id: 'prism-latex',
        kind: 'latex',
        patterns: [
          'dsh-resource://file/**/*.tex',
          'dsh-resource://file/**/*.latex',
          'dsh-resource://file/**/*.ltx',
        ],
        priority: 'extension',
        title: address => titleOfAddress(address),
        // DSH's `claim(address, kind)` THROWS when this refuses, and the open flow then
        // leaves the pane half-updated. The patterns already restrict the suffix, so only
        // re-check that and never refuse a matched file address.
        canOpen: address => isLatexAddress(address),
      }
      const registerTabType = () => {
        disposeTabType = ctx.sidebarRightTabs.register(tabDefinition)
        tabTypeState = 'registered'
      }
      try {
        registerTabType()
      } catch (error) {
        tabTypeState = 'threw'
        tabTypeError = String(error?.message ?? error)
      }
      ctx.effect(() => () => {
        if (typeof disposeTabType !== 'function') return
        // A newer instance may have replaced this definition by id; disposing then would
        // remove the live type and make the owner close the pane on the next interaction.
        try {
          const entries = ctx.sidebarRightTabs?.entries?.()
          if (Array.isArray(entries)) {
            const mine = entries.find(entry => entry?.id === 'prism-latex')
            if (mine !== undefined && mine.canOpen !== tabDefinition.canOpen
              && mine.title !== tabDefinition.title) return
          }
        } catch {
          /* fall through to the normal dispose */
        }
        disposeTabType()
      })

      // A tab type that stops being in force makes the owner close the pane on the next
      // interaction, which looks like "the sidebar disappeared". The registry is cheap to
      // read, so verify it and put the type back when the entry is gone.
      ctx.effect(() => {
        const probe = () => {
          try {
            const entries = ctx.sidebarRightTabs?.entries?.()
            if (!Array.isArray(entries)) return
            if (entries.some(entry => entry?.id === 'prism-latex')) return
            registerTabType()
            tabTypeRecovered += 1
            reportDiagnostic()
          } catch {
            /* the registry may be mid-replacement */
          }
        }
        // Fast for the first few seconds (the window where a click can hit a missing
        // type), then settle to a cheap poll.
        let fast = 60
        const tick = () => {
          probe()
          if (fast > 0) {
            fast -= 1
            timer = setTimeout(tick, 300)
            return
          }
          timer = setInterval(probe, 2000)
        }
        let timer = setTimeout(tick, 300)
        return () => {
          clearTimeout(timer)
          clearInterval(timer)
        }
      })

      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: 'prism-latex',
        locale: 'prismLatex',
      }, LatexTab)))

      // Self report: the browser cannot expose its registries to the Host any other way, so
      // the tab registry's answer for this plugin is written to a temp file by the /files
      // route. It retries because the app may not have restored its session yet at boot.
      /** Which ancestor actually scrolls the view, and how tall the panel really is. */
      const scrollChain = () => {
        try {
          if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return null
          const chain = []
          let node = document.querySelector('.prismlx-panel')
          for (let depth = 0; node !== null && node !== undefined && depth < 8; depth += 1) {
            const style = typeof getComputedStyle === 'function' ? getComputedStyle(node) : undefined
            chain.push({
              tag: String(node.tagName ?? '').toLowerCase(),
              className: typeof node.className === 'string' ? node.className.slice(0, 60) : '',
              overflowY: style?.overflowY ?? '',
              clientHeight: Number(node.clientHeight) || 0,
              scrollHeight: Number(node.scrollHeight) || 0,
              scrollable: (Number(node.scrollHeight) || 0) > (Number(node.clientHeight) || 0) + 1,
            })
            node = node.parentElement
          }
          return chain
        } catch {
          return null
        }
      }

      diagFlush = () => { sendDiagnostic() }
      const sendDiagnostic = () => {
        try {
          const sessionId = readCurrentSessionId()
          const addressSession = sessionId === undefined ? 'diag-session' : sessionId
          const sampleAddress = `dsh-resource://file/session/${encodeURIComponent(addressSession)}/demo/hello.tex`
          const report = {
            build: CLIENT_BUILD,
            scrollChain: scrollChain(),
            jumpTrace: [...jumpTrace],
            tabTypeState,
            tabTypeError,
            tabTypeRecovered,
            tabTypePresent: (() => {
              try {
                const entries = ctx.sidebarRightTabs?.entries?.()
                return Array.isArray(entries)
                  ? entries.some(entry => entry?.id === 'prism-latex')
                  : `not an array: ${String(entries)}`
              } catch (error) {
                return `entries threw: ${String(error?.message ?? error)}`
              }
            })(),
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
          fetch(`api/prism-latex/files?session=diag&diag=${encoded}`, { cache: 'no-store' })
            .catch(() => {})
        } catch {
          /* diagnostics never affect the plugin */
        }
      }
      setTimeout(sendDiagnostic, 800)
      setTimeout(sendDiagnostic, 3000)
      setTimeout(sendDiagnostic, 8000)

    }

    return { name: 'prism-latex', inject: ['slots', 'locale', 'sidebarRightTabs'], apply }
  },
})
