import * as vscode from 'vscode';
import { DiagramPanel } from './panel.js';

export function activate(context: vscode.ExtensionContext): void {
  const cmd = vscode.commands.registerCommand('dc2mermaid.generateDiagram', () => {
    DiagramPanel.createOrShow(context.extensionUri);
  });
  context.subscriptions.push(cmd);

  // Watch for docker-compose file changes so the preview stays in sync
  const watcher = vscode.workspace.createFileSystemWatcher('**/docker-compose*.yml');
  watcher.onDidChange(() => DiagramPanel.refresh());
  watcher.onDidCreate(() => DiagramPanel.refresh());
  context.subscriptions.push(watcher);
}

export function deactivate(): void {}
