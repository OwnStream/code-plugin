import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { state } from "./state";
import { PluginTreeProvider } from "./providers/tree-provider";
import { PanelProvider } from "./providers/panel-provider";
import { MetaEditorProvider } from "./providers/meta-editor-provider";
import { cancelActive } from "./cli";
import { PluginMeta } from "./types";
import { showOutput } from "./output";

function loadPluginFromFolder(folder: string): boolean {
  const metaPath = path.join(folder, "meta.json");
  if (!fs.existsSync(metaPath)) return false;

  try {
    const raw = fs.readFileSync(metaPath, "utf-8");
    const meta = JSON.parse(raw) as PluginMeta;
    state.setPlugin(meta, folder);
    return true;
  } catch {
    return false;
  }
}

function tryAutoLoadPlugin(): void {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    for (const folder of folders) {
      if (loadPluginFromFolder(folder.uri.fsPath)) return;
    }
  }

  const savedFolder = vscode.workspace.getConfiguration("ownstreamPluginTools").get<string>("pluginFolder");
  if (savedFolder) {
    loadPluginFromFolder(savedFolder);
  }
}

export function activate(context: vscode.ExtensionContext) {
  const treeProvider = new PluginTreeProvider();
  const treeView = vscode.window.createTreeView("pluginTree", {
    treeDataProvider: treeProvider,
    showCollapseAll: false,
  });

  const panelProvider = new PanelProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PanelProvider.viewType, panelProvider)
  );

  const metaEditorProvider = new MetaEditorProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(MetaEditorProvider.viewType, metaEditorProvider)
  );

  tryAutoLoadPlugin();

  context.subscriptions.push(
    vscode.commands.registerCommand("ownstreamPluginTools.selectFolder", async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        openLabel: "Load Plugin",
      });
      if (!uris?.[0]) return;

      const folder = uris[0].fsPath;
      if (!loadPluginFromFolder(folder)) {
        vscode.window.showErrorMessage("Selected folder does not contain a valid meta.json file.");
        return;
      }

      vscode.workspace.getConfiguration("ownstreamPluginTools").update("pluginFolder", folder, vscode.ConfigurationTarget.Global);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ownstreamPluginTools.runMethod", (method?: any) => {
      if (!method || !method.id) return;
      state.setActiveMethod(method);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ownstreamPluginTools.showOutput", () => {
      showOutput();
    })
  );

  context.subscriptions.push(treeView);
}

export function deactivate() {
  cancelActive();
  state.dispose();
}
