import * as vscode from "vscode";
import {
	PluginMethod,
	Result,
	SearchResult,
	MetadataResult,
	SeasonsListResult,
	EpisodeMetadataResult,
	SeasonMetadataResult,
	MetadataImage,
} from "../types";

export interface TesterViewState {
	method: PluginMethod | null;
	result: Result | null;
	loading: boolean;
}

export function getWebviewContent(
	state: TesterViewState,
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
): string {
	const nonce = getNonce();
	const cspSource = webview.cspSource;
	const codiconUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, "media", "codicon.css"),
	);

	return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; font-src ${cspSource}; img-src ${cspSource} https:; style-src 'unsafe-inline' ${cspSource}; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${codiconUri}">
  <style>${styles()}</style>
</head>
<body>
  <div id="app">
    <div id="input-mount">
      ${state.method ? renderInputForm(state.method) : renderEmpty()}
    </div>
    <div id="results">
      ${state.loading ? renderLoading(state.method?.label ?? "Task") : state.result ? renderResult(state.result) : ""}
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    function setHtml(id, html) {
      document.getElementById(id).innerHTML = html || '';
    }

    document.getElementById('app').addEventListener('click', event => {
      const el = event.target.closest('[data-action]');
      if (!el) return;
      const { action, method, id, season } = el.dataset;
      if (action === 'selectResult') {
        vscode.postMessage({ type: 'selectResult', id, season, method });
      }
    });

    document.getElementById('app').addEventListener('submit', event => {
      const form = event.target.closest('#tool-form');
      if (!form) return;
      event.preventDefault();
      const params = {};
      for (const [k, v] of new FormData(form).entries()) params[k] = v;
      vscode.postMessage({ type: 'submit', method: form.dataset.method, params });
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'init') {
        setHtml('input-mount', msg.methodHtml);
        setHtml('results', msg.resultHtml);
      } else if (msg.type === 'setMethod') {
        setHtml('input-mount', msg.html);
      } else if (msg.type === 'setLoading') {
        setHtml('results', msg.html);
      } else if (msg.type === 'setResult') {
        setHtml('results', msg.html);
      } else if (msg.type === 'prefill') {
        const el = document.querySelector('[name="' + msg.name + '"]');
        if (el) { el.value = msg.value; el.dispatchEvent(new Event('input')); }
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}

export function renderEmpty(): string {
	return `<div class="empty-state">
    <div class="empty-icon">
      <span class="codicon codicon-beaker"></span>
    </div>
    <p class="empty-title">OwnStream Plugin Tools</p>
    <p class="empty-desc">Select a method from the tree above to get started.</p>
  </div>`;
}

export function renderInputForm(method: PluginMethod): string {
	const fields = method.params
		.map((p) => {
			if (p.type === "pick" && p.options) {
				const options = p.options
					.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`)
					.join("");
				return `<div class="form-group">
					<label class="form-label">${esc(p.label)}${p.required ? " *" : ""}</label>
					<select name="${esc(p.key)}" class="form-select" ${p.required ? "required" : ""}>
						${options}
					</select>
				</div>`;
			}
			return `<div class="form-group">
        <label class="form-label">${esc(p.label)}${p.required ? " *" : ""}</label>
        <input type="${p.type}" name="${esc(p.key)}" class="form-input"
          placeholder="${esc(p.placeholder || "")}"
          ${p.required ? "required" : ""} />
      </div>`;
		})
		.join("");

	return `<div class="input-view">
    <div class="input-header">
      <span class="codicon codicon-symbol-method"></span>
      <span class="input-title">${esc(method.label)}</span>
    </div>
    <p class="input-desc">${esc(method.description)}</p>
    <form id="tool-form" data-method="${esc(method.id)}">
      ${fields}
      <button type="submit" class="form-button">
        <span class="codicon codicon-play"></span> Run
      </button>
    </form>
  </div>`;
}

export function renderLoading(method: string): string {
	return `<div class="loading-state">
    <div class="loading-spinner"></div>
    <p>Running ${esc(method)}...</p>
  </div>`;
}

export function renderResult(result: Result): string {
	switch (result.kind) {
		case "search":
			return renderSearchResult(result);
		case "metadata":
			return renderMetadataResult(result);
		case "episodeMetadata":
			return renderEpisodeMetadataResult(result);
		case "seasonMetadata":
			return renderSeasonMetadataResult(result);
		case "seasonList":
			return renderSeasonListResult(result);
		case "error":
			return renderErrorResult(result);
	}
}

function renderSearchResult(result: SearchResult): string {
	const items = result.items;
	const method =
		result.type?.toLowerCase() === "tv"
			? "metadata.getTv"
			: "metadata.getMovie";

	if (items.length === 0) {
		return `<div class="empty-state">
      <span class="codicon codicon-search"></span>
      <p>No results found</p>
    </div>`;
	}

	const cards = items
		.map((item) => {
			const posterImg = item.poster
				? `<img class="card-poster" src="${esc(item.poster)}" alt="" />`
				: `<div class="card-poster placeholder"><span class="codicon codicon-file-media"></span></div>`;
			const year = item.year ? String(item.year) : "N/A";

			return `<div class="card" data-action="selectResult" data-method="${method}" data-id="${esc(item.id)}">
        ${posterImg}
        <div class="card-info">
          <div class="card-title">${esc(item.titles[0] || "")}</div>
          <div class="card-meta">${year}</div>
          ${
				item.titles.length > 1
					? `<div class="card-subtitle">Extra titles:<ul>${item.titles
							.slice(1)
							.map((x) => `<li>${esc(x)}</li>`)
							.join("")}</ul></div>`
					: ""
			}
        </div>
      </div>`;
		})
		.join("");

	return `<div class="result-view">
    <div class="result-header">
      <span class="result-count">${items.length} results</span>
    </div>
    <div class="result-grid">${cards}</div>
  </div>`;
}

function wrapTable(
	rows: (string | null)[][],
	title: string,
	columns: string[],
): string {
	if (rows.length == 0) return "";
	return `<details>
		<summary>${title} (${rows.length})</summary>
		<table>
			<thead>
				<tr>
					${columns.map((x) => `<th>${x}</th>`).join("")}
				</tr>
			</thead>
			<tbody>
				${rows
					.map(
						(x) => `<tr>
						${x.map((d) => `<td>${d ? esc(d) : `<i>null</i>`}</td>`).join("")}
					</tr>`,
					)
					.join("")}
			</tbody>
		</table>
	</details>`;
}

function wrapImages(images: MetadataImage[] | undefined, title: string, imageClass: string, indent: boolean = true): string {
	if (!images || images.length == 0) return "";
	return `<div ${indent && `style="padding-left: 16px"`}>
		<details>
			<summary>${title} (${images.length})</summary>
			<div class="image_gallery">
				${images
					.sort((a, b) => {
						const aMissing = a.locale == null;
						const bMissing = b.locale == null;

						const aScore = a.score ?? 1;
						const bScore = b.score ?? 1;
						let scoreCompare = bScore - aScore
						scoreCompare = scoreCompare > 0 ? 1 : scoreCompare < 0 ? -1 : 0;

						if (aMissing !== bMissing) return aMissing ? -1 : 1;
						if (aMissing) return scoreCompare;

						const localeCompare = a.locale?.localeCompare(b.locale || "") || 0;

						return localeCompare || scoreCompare;
					})
					.map(
						(x) => `<div class="localized_image ${imageClass}">
						<img src="${x.url}" alt=""/>
						<div style="display:flex;flex-direction:row;gap:4px;padding-top:4px;justify-content:center;">
							<span class="badge">${x.locale ? x.locale : "<i>No locale</i>"}</span>
							${x.score != undefined ? `<span class="badge">${(x.score * 100).toFixed(0)}%</span>` : ""}
						</div>
					</div>`,
					)
					.join("")}
			</div>
		</details>
	</div>`;
}

function renderMetadataResult(result: MetadataResult): string {
	const images = result.images?.poster ?? [];
	const poster = images.length > 0 ? images[0] : null;
	const posterImg = poster
		? `<img class="detail-poster" src="${esc(poster.url)}" alt="" />`
		: `<img class="detail-poster placeholder"><span class="codicon codicon-file-media"></span></div>`;
	const year = result.releaseDate ?? "";
	const finish = result.finishDate ? ` - ${result.finishDate}` : "";
	const ratings = result.ageRatings ? Object.entries(result.ageRatings) : [];
	const translationsMap: Record<string, (string | null)[]> = {};
	Object.entries(result.titleTranslations ?? {}).forEach((x) => {
		if (!Object.keys(translationsMap).includes(x[0]))
			translationsMap[x[0]] = [x[0], null, null, null];
		translationsMap[x[0]][1] = x[1];
	});
	Object.entries(result.taglineTranslations ?? {}).forEach((x) => {
		if (!Object.keys(translationsMap).includes(x[0]))
			translationsMap[x[0]] = [x[0], null, null, null];
		translationsMap[x[0]][2] = x[1];
	});
	Object.entries(result.descriptionTranslations ?? {}).forEach((x) => {
		if (!Object.keys(translationsMap).includes(x[0]))
			translationsMap[x[0]] = [x[0], null, null, null];
		translationsMap[x[0]][3] = x[1];
	});
	const translations = Object.values(translationsMap).sort((x, y) =>
		x[0]!.localeCompare(y[0]!),
	);
	const showImages = result.images != null &&
		((result.images.poster?.length || 0) > 0 ||
		(result.images.banner?.length || 0) > 0 ||
		(result.images.logo?.length || 0) > 0 ||
		(result.images.backdrop?.length || 0) > 0 ||
		(result.images.thumbnail?.length || 0) > 0);

	return `
	<div class="result-view detail-view">
		<div class="detail-body">
			<div class="detail-header">
				${posterImg}
				<div>
					<h2 class="detail-title">${esc(result.title)}</h2>
					${result.tagline ? `<p class="detail-tagline">${esc(result.tagline)}</p>` : ""}
					<div class="detail-meta">
						<span>${year ? `<span>${esc(year + finish)}</span>` : ""}</span>
					</div>
				</div>
			</div>
			${result.description ? `<h2 class="detail-title">Description</h2><p class="detail-desc">${esc(result.description)}</p>` : ""}
			${translations ? wrapTable(translations, "Translations", ["Locale", "Title", "Tagline", "Description"]) : ""}
			${ratings ? wrapTable(ratings, "Age Ratings", ["Locale", "Rating"]) : ""}
			${showImages ? `<details>
				<summary>Images</summary>
				${wrapImages(result.images!.poster, "Posters", "poster")}
				${wrapImages(result.images!.banner, "Banners", "banner")}
				${wrapImages(result.images!.logo, "Logos", "thumbnail")}
				${wrapImages(result.images!.backdrop, "Backdrops", "thumbnail")}
				${wrapImages(result.images!.thumbnail, "Thumbnails", "thumbnail")}
			</details>` : ""}
		</div>
	</div>`;
}

function renderEpisodeMetadataResult(result: EpisodeMetadataResult): string {
	const images = result.thumbnails ?? [];
	const poster = images.length > 0 ? images[0] : null;
	const posterImg = poster
		? `<img class="detail-thumbnail" src="${esc(poster.url)}" alt="" />`
		: "";
	const translationsMap: Record<string, (string | null)[]> = {};
	Object.entries(result.titleTranslations ?? {}).forEach((x) => {
		if (!Object.keys(translationsMap).includes(x[0]))
			translationsMap[x[0]] = [x[0], null, null];
		translationsMap[x[0]][1] = x[1];
	});
	Object.entries(result.summaryTranslations ?? {}).forEach((x) => {
		if (!Object.keys(translationsMap).includes(x[0]))
			translationsMap[x[0]] = [x[0], null, null];
		translationsMap[x[0]][2] = x[1];
	});
	const translations = Object.values(translationsMap).sort((x, y) =>
		x[0]!.localeCompare(y[0]!),
	);

	return `<div class="result-view detail-view">
    <div class="detail-body">
      ${posterImg}
	  <h2 class="detail-title">${esc(result.title)}</h2>
      ${result.summary ? `<p class="detail-desc">${esc(result.summary)}</p>` : ""}
	  ${translations ? wrapTable(translations, "Translations", ["Locale", "Title", "Summary"]) : ""}
	  ${wrapImages(result.thumbnails, "Thumbnails", "thumbnail", false)}
    </div>
  </div>`;
}

function renderSeasonMetadataResult(result: SeasonMetadataResult): string {
	const images = result.posters ?? [];
	const poster = images.length > 0 ? images[0] : null;
	const posterImg = poster
		? `<img class="detail-poster" src="${esc(poster.url)}" alt="" />`
		: `<img class="detail-poster placeholder"><span class="codicon codicon-file-media"></span></div>`;
	const translationsMap: Record<string, (string | null)[]> = {};
	Object.entries(result.titleTranslations ?? {}).forEach((x) => {
		if (!Object.keys(translationsMap).includes(x[0]))
			translationsMap[x[0]] = [x[0], null, null];
		translationsMap[x[0]][1] = x[1];
	});
	Object.entries(result.descriptionTranslations ?? {}).forEach((x) => {
		if (!Object.keys(translationsMap).includes(x[0]))
			translationsMap[x[0]] = [x[0], null, null];
		translationsMap[x[0]][2] = x[1];
	});
	const translations = Object.values(translationsMap).sort((x, y) =>
		x[0]!.localeCompare(y[0]!),
	);

	return `
	<div class="result-view detail-view">
		<div class="detail-body">
			<div class="detail-header">
				${posterImg}
				<div>
					<h2 class="detail-title">${esc(result.title)}</h2>
					${result.description ? `<p class="detail-desc">${esc(result.description)}</p>` : ""}
				</div>
			</div>
			${translations ? wrapTable(translations, "Translations", ["Locale", "Title", "Description"]) : ""}
			${wrapImages(images, "Posters", "poster", false)}
		</div>
	</div>`;
}

function renderSeasonListResult(result: SeasonsListResult): string {
	const items = result.items;
	if (items.length === 0) {
		return `<div class="empty-state">
			<span class="codicon codicon-search"></span>
			<p>No seasons found</p>
		</div>`;
	}

	const cards = items
		.map((item) => {
			const posterImg = item.posters
				? `<img class="card-poster" src="${esc(item.posters[0].url)}" alt="" />`
				: `<div class="card-poster placeholder"><span class="codicon codicon-file-media"></span></div>`;
			return `<div class="card" data-action="selectResult" data-method="metadata.getSeason" data-id="${esc(item.id)}" data-season="${item.index}">
				${posterImg}
				<div class="card-info">
				<div class="card-title">Season ${item.index}</div>
				<div class="card-meta">${esc(item.name)}</div>
				</div>
			</div>`;
		})
		.join("");

	return `<div class="result-view">
		<div class="result-grid">${cards}</div>
	</div>`;
}

function renderErrorResult(result: {
	kind: "error";
	message: string;
	raw?: string;
}): string {
	return `<div class="error-state">
    <div class="error-icon">
      <span class="codicon codicon-error"></span>
    </div>
    <p class="error-msg">${esc(result.message)}</p>
    ${result.raw ? `<pre class="error-raw">${esc(result.raw)}</pre>` : ""}
  </div>`;
}

function esc(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function getNonce(): string {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let text = "";
	for (let i = 0; i < 32; i++) {
		text += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return text;
}

function styles(): string {
	return `
		* {
			box-sizing: border-box;
			margin: 0;
			padding: 0;
		}

		body {
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-sideBar-foreground);
			background: var(--vscode-sideBar-background);
			padding: 8px;
		}

		.empty-state {
			text-align: center;
			padding: 32px 16px;
		}

		.empty-icon .codicon {
			font-size: 48px;
			color: var(--vscode-descriptionForeground);
		}

		.empty-title {
			font-size: 14px;
			font-weight: 600;
			margin-top: 12px;
		}

		.empty-desc {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-top: 4px;
		}

		.input-header {
			display: flex;
			align-items: center;
			gap: 6px;
			margin-bottom: 4px;
		}

		.input-header .codicon {
			font-size: 16px;
			color: var(--vscode-descriptionForeground);
		}

		.input-title {
			font-weight: 600;
			font-size: 13px;
		}

		.input-desc {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 12px;
		}

		.form-group {
			margin-bottom: 10px;
		}

		.form-label {
			display: block;
			font-size: 12px;
			font-weight: 500;
			margin-bottom: 4px;
		}

		.form-input, .form-select {
			width: 100%;
			padding: 4px 8px;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-input-foreground);
			background: var(--vscode-input-background);
			border: 1px solid var(--vscode-input-border);
			border-radius: 2px;
			outline: none;
		}

		.form-input:focus, .form-select:focus {
			border-color: var(--vscode-focusBorder);
		}

		.form-button {
			width: 100%;
			padding: 6px 12px;
			margin-top: 4px;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-button-foreground);
			background: var(--vscode-button-background);
			border: none;
			border-radius: 2px;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 4px;
		}

		.form-button:hover {
			background: var(--vscode-button-hoverBackground);
		}

		.form-button .codicon {
			font-size: 14px;
		}

		#results {
			margin-top: 12px;
			border-top: 1px solid var(--vscode-widget-border);
			padding-top: 12px;
		}

		.loading-state {
			text-align: center;
			padding: 32px 16px;
		}

		.loading-state p {
			margin-top: 8px;
			color: var(--vscode-descriptionForeground);
			font-size: 12px;
		}

		.loading-spinner {
			width: 24px;
			height: 24px;
			margin: 0 auto;
			border: 2px solid var(--vscode-descriptionForeground);
			border-top-color: transparent;
			border-radius: 50%;
			animation: spin 0.8s linear infinite;
		}

		@keyframes spin {
			to {
				transform: rotate(360deg);
			}
		}

		.result-header {
			margin-bottom: 8px;
		}

		.result-count {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}

		.result-grid {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		.card {
			display: flex;
			gap: 8px;
			padding: 6px;
			border: 1px solid var(--vscode-widget-border);
			border-radius: 4px;
			cursor: pointer;
			transition: background 0.1s;
		}

		.card:hover {
			background: var(--vscode-list-hoverBackground);
		}

		.card-poster {
			width: 48px;
			height: 64px;
			object-fit: cover;
			border-radius: 2px;
			flex-shrink: 0;
		}

		.card-poster.placeholder {
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--vscode-widget-border);
		}

		.card-poster.placeholder .codicon {
			font-size: 20px;
			color: var(--vscode-descriptionForeground);
		}

		.card-info {
			flex: 1;
			min-width: 0;
			display: flex;
			flex-direction: column;
			justify-content: center;
		}

		.card-title {
			font-size: 12px;
			font-weight: 600;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.card-subtitle {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.card-meta {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			margin-top: 2px;
		}

		.detail-header {
			display: flex;
			flex-direction: row;
			gap: 12px;
		}

		.detail-poster {
			width: 40%;
			aspect-ratio: 2/3;
			max-width: 150px;
			object-fit: cover;
			border-radius: 4px;
			margin-bottom: 8px;
		}

		.detail-title {
			font-size: 14px;
			font-weight: 600;
			margin-bottom: 4px;
		}

		.detail-tagline {
			font-size: 13px;
			font-weight: 400;
			font-style: italic;
			margin-bottom: 4px;
		}

		.detail-meta {
			display: flex;
			flex-wrap: wrap;
			gap: 4px;
			margin-bottom: 8px;
		}

		.detail-meta span {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
		}

		.badge {
			font-size: 10px;
			padding: 1px 6px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
			border-radius: 8px;
		}

		.detail-desc {
			font-size: 12px;
			line-height: 1.5;
		}

		.error-state {
			text-align: center;
			padding: 16px;
		}

		.error-icon .codicon {
			font-size: 32px;
			color: var(--vscode-errorForeground);
		}

		.error-msg {
			margin-top: 8px;
			font-size: 12px;
			color: var(--vscode-errorForeground);
		}

		.error-raw {
			text-align: left;
			margin-top: 8px;
			padding: 8px;
			background: var(--vscode-textCodeBlock-background);
			border-radius: 4px;
			font-size: 11px;
			overflow-x: auto;
			white-space: pre-wrap;
			word-break: break-all;
		}

		table {
			border-collapse: collapse;
		}

		tr:nth-child(even) {
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
		}

		td {
			border-top: 1px solid var(--vscode-badge-foreground);
			padding: 4px 0;
		}

		summary {
			font-weight: bold;
			padding: 8px 0;
			cursor: pointer;
		}

		.image_gallery {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
		}

		.localized_image {
			display: flex;
			flex-direction: column;
		}

		.localized_image > span {
			text-align: center;
		}

		.localized_image > img {
			max-height: 150px;
			object-fit: contain;
		}

		.localized_image.poster > img {
			aspect-ratio: 2/3;
		}

		.localized_image.banner > img {
			aspect-ratio: 5/1;
		}

		.localized_image.thumbnail > img {
			aspect-ratio: 16/9;
		}
  `;
}
