import * as vscode from "vscode";

let channel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel("OwnStream Plugin Tools");
  }
  return channel;
}

export function log(message: string) {
  getOutputChannel().appendLine(message);
}

export function logSection(title: string) {
  const ch = getOutputChannel();
  ch.appendLine("");
  ch.appendLine(`${"─".repeat(40)}`);
  ch.appendLine(title);
  ch.appendLine(`${"─".repeat(40)}`);
}

export function showOutput() {
  getOutputChannel().show(true);
}
