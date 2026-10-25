import * as vscode from "vscode";
import { PluginMeta, PluginMethod, Result } from "./types";

class ExtensionState {
  private _onDidChangeResult = new vscode.EventEmitter<Result | null>();
  readonly onDidChangeResult = this._onDidChangeResult.event;

  private _onDidChangePlugin = new vscode.EventEmitter<PluginMeta | null>();
  readonly onDidChangePlugin = this._onDidChangePlugin.event;

  private _onDidChangeActiveMethod = new vscode.EventEmitter<PluginMethod | null>();
  readonly onDidChangeActiveMethod = this._onDidChangeActiveMethod.event;

  pluginMeta: PluginMeta | null = null;
  pluginFolder: string | null = null;
  lastResult: Result | null = null;
  isRunning: boolean = false;
  activeMethod: PluginMethod | null = null;

  setResult(result: Result | null) {
    this.lastResult = result;
    this.isRunning = false;
    this._onDidChangeResult.fire(result);
  }

  setPlugin(meta: PluginMeta | null, folder: string | null) {
    this.pluginMeta = meta;
    this.pluginFolder = folder;
    this.lastResult = null;
    this.activeMethod = null;
    this._onDidChangePlugin.fire(meta);
  }

  setActiveMethod(method: PluginMethod | null) {
    this.activeMethod = method;
    this.lastResult = null;
    this._onDidChangeActiveMethod.fire(method);
  }

  setRunning(running: boolean) {
    this.isRunning = running;
  }

  dispose() {
    this._onDidChangeResult.dispose();
    this._onDidChangePlugin.dispose();
    this._onDidChangeActiveMethod.dispose();
  }
}

export const state = new ExtensionState();
