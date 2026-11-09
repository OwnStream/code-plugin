import * as vscode from "vscode";
import { state } from "../state";
import { runMethod } from "../cli";
import {
  getWebviewContent,
  renderEmpty,
  renderInputForm,
  renderLoading,
  renderResult,
} from "../webview/html";

export class PanelProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "pluginPanel";
  private view?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {
    state.onDidChangeActiveMethod((method) => {
      this.view?.webview.postMessage({
        type: "setMethod",
        html: method ? renderInputForm(method) : renderEmpty(),
      });
    });

    state.onDidChangeResult((result) => {
      this.view?.webview.postMessage({
        type: "setResult",
        html: result ? renderResult(result) : "",
      });
    });
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
          this.view?.webview.postMessage({
            type: "init",
            methodHtml: state.activeMethod ? renderInputForm(state.activeMethod) : renderEmpty(),
            resultHtml: state.lastResult ? renderResult(state.lastResult) : "",
          });
          break;
        case "submit": {
          const method = state.activeMethod;
          if (!method) return;
          this.view?.webview.postMessage({
            type: "setLoading",
            html: renderLoading(method.label),
          });
          await runMethod(method.id, msg.params);
          break;
        }
        case "selectResult": {
          const { METHOD_REGISTRY } = await import("../types");
          const method = Object.values(METHOD_REGISTRY).filter(x => x.id.toString() == msg.method)[0];
          if (method) {
            state.setActiveMethod(method);
            setTimeout(() => {
              this.view?.webview.postMessage({ type: "prefill", name: "id", value: msg.id });
              this.view?.webview.postMessage({ type: "prefill", name: "season", value: msg.season });
            }, 50);
		  }
          break;
        }
      }
    });

    this.view.webview.html = getWebviewContent({ method: null, result: null, loading: false }, this.view.webview, this.extensionUri);
  }

  dispose() {}
}
