import * as vscode from 'vscode';
import { generate } from 'dc2mermaid-core';

const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
const VIEW_TYPE = 'dc2mermaidPreview';
const VIEW_TITLE = 'Docker Compose Diagram';

export class DiagramPanel {
  static currentPanel: DiagramPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  // ── Static API ────────────────────────────────────────────────────────────

  static createOrShow(_extensionUri: vscode.Uri): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (DiagramPanel.currentPanel) {
      DiagramPanel.currentPanel.panel.reveal(column);
      void DiagramPanel.currentPanel.update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      VIEW_TITLE,
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        // Restrict the webview to only load resources from CDN — no local file access needed
        retainContextWhenHidden: true,
      },
    );

    DiagramPanel.currentPanel = new DiagramPanel(panel);
  }

  static refresh(): void {
    if (DiagramPanel.currentPanel) {
      void DiagramPanel.currentPanel.update();
    }
  }

  // ── Instance ──────────────────────────────────────────────────────────────

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;

    // Set initial HTML immediately so the user sees a loading state
    this.panel.webview.html = this.getHtmlForWebview();

    // Dispose when the panel is closed by the user
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Re-render whenever the panel becomes visible again
    this.panel.onDidChangeViewState(
      (e) => {
        if (e.webviewPanel.visible) {
          void this.update();
        }
      },
      null,
      this.disposables,
    );

    // Handle messages sent back from the webview (e.g., "copy" button)
    this.panel.webview.onDidReceiveMessage(
      async (message: unknown) => {
        if (!isWebviewMessage(message)) return;

        if (message.type === 'copy') {
          await vscode.env.clipboard.writeText(message.text);
          void vscode.window.showInformationMessage('Mermaid diagram copied to clipboard.');
        }
      },
      null,
      this.disposables,
    );

    void this.update();
  }

  private async update(): Promise<void> {
    // Find the first docker-compose file in the workspace
    const files = await vscode.workspace.findFiles(
      '**/docker-compose*.yml',
      '**/node_modules/**',
      1,
    );

    if (files.length === 0) {
      this.postMessage({
        type: 'error',
        message: 'No docker-compose*.yml file found in workspace.',
      });
      return;
    }

    const composeFile = files[0];
    if (!composeFile) {
      this.postMessage({
        type: 'error',
        message: 'No docker-compose*.yml file found in workspace.',
      });
      return;
    }

    const filePath = composeFile.fsPath;

    try {
      const mermaidString = await generate({
        files: [filePath],
        render: {
          type: 'flowchart',
          direction: 'LR',
          includeVolumes: true,
          includePorts: true,
          includeNetworkBoundaries: true,
          theme: {},
        },
        strict: false,
        verbose: false,
      });

      this.postMessage({ type: 'update', mermaid: mermaidString });
    } catch (err: unknown) {
      const message = isErrorWithMessage(err) ? err.message : 'Unknown error generating diagram.';

      // generate() is not yet implemented — surface a friendly message rather than crashing
      if (message.includes('not yet implemented')) {
        this.postMessage({
          type: 'error',
          message:
            'Core pipeline not yet implemented. Diagram preview will be available once the parser and renderer issues are resolved.',
        });
        return;
      }

      this.postMessage({ type: 'error', message: `Failed to generate diagram: ${message}` });
    }
  }

  private postMessage(msg: WebviewInboundMessage): void {
    void this.panel.webview.postMessage(msg);
  }

  /** Returns the full HTML document served inside the webview. */
  private getHtmlForWebview(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Docker Compose Diagram</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground, #ccc);
      background: var(--vscode-editor-background, #1e1e1e);
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      padding: 16px;
    }

    #toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }

    #copy-btn {
      padding: 4px 12px;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
      cursor: pointer;
      border-radius: 2px;
      font-size: 12px;
    }

    #copy-btn:hover {
      background: var(--vscode-button-hoverBackground, #1177bb);
    }

    #copy-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    #status {
      font-size: 12px;
      color: var(--vscode-descriptionForeground, #888);
    }

    #diagram-container {
      flex: 1;
      overflow: auto;
    }

    #diagram-container svg {
      max-width: 100%;
    }

    #loading {
      color: var(--vscode-descriptionForeground, #888);
      font-style: italic;
    }

    #error-box {
      display: none;
      padding: 12px 16px;
      border-left: 3px solid var(--vscode-inputValidation-errorBorder, #f14c4c);
      background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      color: var(--vscode-inputValidation-errorForeground, #f14c4c);
      border-radius: 2px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div id="toolbar">
    <button id="copy-btn" disabled>Copy Mermaid</button>
    <span id="status">Generating diagram…</span>
  </div>

  <div id="diagram-container">
    <p id="loading">Loading diagram…</p>
    <div id="error-box"></div>
    <div id="mermaid-output"></div>
  </div>

  <script src="${MERMAID_CDN}"></script>
  <script>
    // eslint-disable-next-line no-undef
    const vscodeApi = acquireVsCodeApi();

    mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });

    const copyBtn = document.getElementById('copy-btn');
    const statusEl = document.getElementById('status');
    const loadingEl = document.getElementById('loading');
    const errorBox = document.getElementById('error-box');
    const outputEl = document.getElementById('mermaid-output');

    let currentMermaid = '';

    copyBtn.addEventListener('click', () => {
      if (currentMermaid) {
        vscodeApi.postMessage({ type: 'copy', text: currentMermaid });
      }
    });

    function showLoading() {
      loadingEl.style.display = 'block';
      errorBox.style.display = 'none';
      outputEl.innerHTML = '';
      copyBtn.disabled = true;
      statusEl.textContent = 'Generating diagram…';
    }

    function showError(message) {
      loadingEl.style.display = 'none';
      errorBox.style.display = 'block';
      errorBox.textContent = message;
      outputEl.innerHTML = '';
      copyBtn.disabled = true;
      statusEl.textContent = 'Error';
    }

    async function renderDiagram(mermaidStr) {
      loadingEl.style.display = 'none';
      errorBox.style.display = 'none';
      currentMermaid = mermaidStr;

      try {
        const { svg } = await mermaid.render('dc2mermaid-diagram', mermaidStr);
        outputEl.innerHTML = svg;
        copyBtn.disabled = false;
        statusEl.textContent = 'Diagram ready';
      } catch (err) {
        showError('Failed to render Mermaid diagram: ' + (err && err.message ? err.message : String(err)));
      }
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || typeof msg.type !== 'string') return;

      if (msg.type === 'update') {
        void renderDiagram(msg.mermaid);
      } else if (msg.type === 'error') {
        showError(msg.message);
      }
    });
  </script>
</body>
</html>`;
  }

  dispose(): void {
    DiagramPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

// ── Type guards ──────────────────────────────────────────────────────────────

type WebviewInboundMessage =
  | { type: 'update'; mermaid: string }
  | { type: 'error'; message: string };

interface CopyMessage {
  type: 'copy';
  text: string;
}

function isWebviewMessage(value: unknown): value is CopyMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as Record<string, unknown>)['type'] === 'copy' &&
    'text' in value &&
    typeof (value as Record<string, unknown>)['text'] === 'string'
  );
}

function isErrorWithMessage(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as Record<string, unknown>)['message'] === 'string'
  );
}
