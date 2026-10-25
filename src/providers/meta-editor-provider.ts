import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { state } from "../state";
import { spawn } from "child_process";
import { getCliPath } from "../settings";
import { log, logSection } from "../output";
import { PluginMeta } from "../types";
import { getMetaEditorHtml } from "../webview/meta-html";

export class MetaEditorProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "metaEditor";
  private view?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {
    state.onDidChangePlugin(() => this.reload());
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "ready":
          this.reload();
          break;
        case "save":
          await this.save(msg.meta);
          break;
        case "validate":
          await this.validate();
          break;
      }
    });

    const codiconUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "codicon.css")
    );

    this.view.webview.html = getMetaEditorHtml(codiconUri.toString(), webviewView.webview.cspSource);
  }

  private getMetaPath(): string | null {
    if (!state.pluginFolder) return null;
    return path.join(state.pluginFolder, "meta.json");
  }

  private readMeta(): PluginMeta | null {
    const metaPath = this.getMetaPath();
    if (!metaPath || !fs.existsSync(metaPath)) return null;

    try {
      const content = fs.readFileSync(metaPath, "utf-8");
      return JSON.parse(content) as PluginMeta;
    } catch {
      return null;
    }
  }

  private reload() {
    const meta = this.readMeta();
    if (meta) {
      this.view?.webview.postMessage({ type: "init", meta, error: null });
    } else {
      this.view?.webview.postMessage({
        type: "init",
        meta: null,
        error: state.pluginFolder ? "meta.json not found or invalid" : "No plugin folder loaded",
      });
    }
  }

  private async save(meta: PluginMeta) {
    const metaPath = this.getMetaPath();
    if (!metaPath) {
      this.view?.webview.postMessage({ type: "saveResult", ok: false, error: "No plugin folder loaded" });
      return;
    }

    try {
      const json = JSON.stringify(meta, null, "\t") + "\n";
      fs.writeFileSync(metaPath, json, "utf-8");
      state.setPlugin(meta, state.pluginFolder);
      this.view?.webview.postMessage({ type: "saveResult", ok: true, error: null });
    } catch (err: any) {
      this.view?.webview.postMessage({ type: "saveResult", ok: false, error: `Failed to write: ${err.message}` });
    }
  }

  private async validate() {
    if (!state.pluginFolder) {
      this.view?.webview.postMessage({ type: "validateResult", success: false, message: "No plugin folder loaded", meta: null });
      return;
    }

    const cliPath = getCliPath();
    logSection(`Validating meta.json: ${cliPath} --json --project ${state.pluginFolder} testMeta`);

    return new Promise<void>((resolve) => {
      const proc = spawn(cliPath, ["--json", "--project", state.pluginFolder!, "testMeta"], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on("close", (code) => {
        log(`[testMeta exit ${code}] ${stdout}`);
        if (stderr) log(`[testMeta stderr] ${stderr}`);

        try {
          const parsed = JSON.parse(stdout);
          this.view?.webview.postMessage({
            type: "validateResult",
            success: parsed.success ?? (code === 0),
            message: parsed.message ?? (code === 0 ? "Validation passed" : `CLI exited with code ${code}`),
            meta: parsed.meta ?? null,
          });
        } catch {
          this.view?.webview.postMessage({
            type: "validateResult",
            success: false,
            message: `Failed to parse CLI output: ${stdout || stderr || "no output"}`,
            meta: null,
          });
        }
        resolve();
      });

      proc.on("error", (err) => {
        log(`[testMeta error] ${err.message}`);
        this.view?.webview.postMessage({
          type: "validateResult",
          success: false,
          message: `Failed to spawn CLI: ${err.message}`,
          meta: null,
        });
        resolve();
      });
    });
  }

  dispose() {}
}
