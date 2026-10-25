import * as vscode from "vscode";

export function getCliPath(): string {
  return vscode.workspace.getConfiguration("ownstreamPluginTools").get<string>("cliPath", "OwnStream.PluginCli");
}
