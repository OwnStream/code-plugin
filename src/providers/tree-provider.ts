import * as vscode from "vscode";
import { state } from "../state";
import { PluginFeature, METHOD_REGISTRY, PluginMethod, PluginMeta } from "../types";

type TreeNode = PluginInfoNode | MethodNode | EmptyNode;

class PluginInfoNode extends vscode.TreeItem {
  constructor(meta: PluginMeta) {
    super(meta.name, vscode.TreeItemCollapsibleState.Expanded);
    if (meta.version) {
      this.description = `v${meta.version.name}`;
    }
    this.contextValue = "pluginInfo";
    this.iconPath = new vscode.ThemeIcon("package");
  }
}

class MethodNode extends vscode.TreeItem {
  method: PluginMethod;

  constructor(method: PluginMethod) {
    super(method.label, vscode.TreeItemCollapsibleState.None);
    this.method = method;
    this.description = method.description;
    this.contextValue = "method";

    const iconMap: Record<string, string> = {
      "metadata.search": "search",
      "metadata.get.movie": "device-camera-video",
      "metadata.get.tv": "device-desktop",
      "metadata.get.tv.seasons": "list-ordered",
      "metadata.get.season": "list-tree",
      "metadata.get.episode": "play-circle",
    };
    this.iconPath = new vscode.ThemeIcon(iconMap[method.feature] || "symbol-method");

    this.command = {
      command: "ownstreamPluginTools.runMethod",
      title: "Run Method",
      arguments: [method],
    };
  }
}

class EmptyNode extends vscode.TreeItem {
  constructor() {
    super("No plugin loaded", vscode.TreeItemCollapsibleState.None);
    this.description = "Run 'OwnStream Plugin Tools: Select Plugin Folder' to load a plugin";
    this.iconPath = new vscode.ThemeIcon("info");
    this.contextValue = "empty";
  }
}

export class PluginTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() {
    state.onDidChangePlugin(() => this.refresh());
  }

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      if (state.pluginMeta) {
        return [new PluginInfoNode(state.pluginMeta)];
      }
      return [new EmptyNode()];
    }

    if (element instanceof PluginInfoNode) {
      const features = state.pluginMeta?.features ?? [];
      return features
        .filter((f): f is PluginFeature => f in METHOD_REGISTRY)
        .map((f) => new MethodNode(METHOD_REGISTRY[f]));
    }

    return [];
  }

  dispose() {
    this._onDidChangeTreeData.dispose();
  }
}
