export function getMetaEditorHtml(
	codiconUri: string | null,
	cspSource: string,
): string {
	const nonce = getNonce();

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none'; font-src ${cspSource}; img-src ${cspSource} https:; style-src 'unsafe-inline' ${cspSource}; script-src 'nonce-${nonce}';">
	${codiconUri ? `<link rel="stylesheet" href="${codiconUri}">` : ""}
	<style>${styles()}</style>
</head>
<body>
	<div id="app">
		<div class="editor-header">
			<span class="codicon codicon-file-code"></span>
			<span class="editor-title">meta.json</span>      <div class="editor-actions">
				<button id="btn-validate" class="form-button secondary" disabled>
					Validate
				</button>
				<button id="btn-save" class="form-button" disabled>
					Save
				</button>
			</div>
		</div>
		<div id="message" class="message-bar" style="display:none;"></div>
		<div id="form-container" class="form-container">
			<p class="placeholder-text">No plugin loaded</p>
		</div>
	</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		let currentMeta = null;
		let dirty = false;

		const container = document.getElementById('form-container');
		const btnSave = document.getElementById('btn-save');
		const btnValidate = document.getElementById('btn-validate');
		const messageBar = document.getElementById('message');

		btnValidate.addEventListener('click', () => {
			btnValidate.disabled = true;
			btnValidate.innerHTML = 'Validating...';
			vscode.postMessage({ type: 'validate' });
		});

		btnSave.addEventListener('click', () => {
			const meta = collectForm();
			if (!meta) return;
			vscode.postMessage({ type: 'save', meta });
		});

		function markDirty() {
			dirty = true;
			btnSave.disabled = false;
		}

		function collectForm() {
			if (!currentMeta) return null;
			return {
			id: gv('field-id') || currentMeta.id,
				name: gv('field-name') || currentMeta.name,
				version: {
					name: gv('field-version-name') || (currentMeta.version && currentMeta.version.name) || '',
					code: parseInt(gv('field-version-code') || '0', 10) || (currentMeta.version && currentMeta.version.code) || 0
				},
			index: gv('field-index') || currentMeta.index,
				image: gv('field-image') || null,
				permissions: getList('perms'),
				features: getChecked('features'),
				homepage: gv('field-homepage') || null,
				source: gv('field-source') || null,
				issues: gv('field-issues') || null,
				autoUpdater: document.getElementById('au-enabled').checked ? {
					type: gv('field-au-type') || '',
					params: getKV('au-params')
				} : null
			};
		}

		function gv(id) { const e = document.getElementById(id); return e ? e.value.trim() : ''; }

		function getList(prefix) {
			const items = [];
			document.querySelectorAll('#' + prefix + '-list .list-item input[type="text"]').forEach(el => {
				if (el.value.trim()) items.push(el.value.trim());
			});
			return items;
		}

		function getChecked(name) {
			const items = [];
			document.querySelectorAll('input[name="' + name + '"]:checked').forEach(el => items.push(el.value));
			return items;
		}

		function getKV(containerId) {
			const params = {};
			document.querySelectorAll('#' + containerId + '-list .kv-row').forEach(row => {
				const k = row.querySelector('.kv-key').value.trim();
				const v = row.querySelector('.kv-val').value.trim();
				if (k) params[k] = v;
			});
			return params;
		}

		function renderForm(meta) {
			const allFeatures = ['metadata.search', 'metadata.getMovie', 'metadata.getTv', 'metadata.getTvSeasons', 'metadata.getTvSeason', 'metadata.getTvEpisode'];
			const perms = meta.permissions || [];
			const features = meta.features || [];
			const au = meta.autoUpdater || {};
			const auParams = au.params || {};
			const auParamRows = Object.entries(auParams).map(([k,v]) => kvRowHTML(k, v)).join('');

			container.innerHTML =
				section('ID', input('field-id', 'text', meta.id || '', true)) +
				section('Name', input('field-name', 'text', meta.name || '', true)) +
				section('Version',
					row([
						inputGroup('Version Name', 'field-version-name', 'text', meta.version?.name || '', true),
						inputGroup('Version Code', 'field-version-code', 'number', String(meta.version?.code ?? 0), true)
					])
				) +
				section('Index', input('field-index', 'text', meta.index || '', true)) +
				section('Image', input('field-image', 'text', meta.image || '', false, 'https://...')) +
				section('Permissions', stringList('perms', perms)) +
				section('Features',
					'<div class="check-grid">' +
						allFeatures.map(f =>
							'<label class="check-label"><input type="checkbox" name="features" value="' + f + '"' +
							(features.includes(f) ? ' checked' : '') + '/> ' + esc(f) + '</label>'
						).join('') +
					'</div>'
				) +
				section('Homepage', input('field-homepage', 'text', meta.homepage || '', false, 'https://...')) +
				section('Source', input('field-source', 'text', meta.source || '', false, 'https://...')) +
				section('Issues', input('field-issues', 'text', meta.issues || '', false, 'https://...')) +
				section('Auto Updater',
					'<label class="check-label" style="margin-bottom:8px"><input type="checkbox" id="au-enabled"' +
						(meta.autoUpdater ? ' checked' : '') + '/> Enable auto updater</label>' +
					'<div id="au-fields" class="sub-fields" style="display:' + (meta.autoUpdater ? 'block' : 'none') + '">' +
						input('field-au-type', 'text', au.type || '', false) + // TODO: will be a dropdown when we're done with this feature
						kvList('au-params', auParamRows) +
					'</div>'
				);

			bindEvents();
			dirty = false;
			btnSave.disabled = true;
		}

		function bindEvents() {
			container.querySelectorAll('input, textarea, select').forEach(el => {
				el.addEventListener('input', markDirty);
				el.addEventListener('change', markDirty);
			});
			container.querySelectorAll('.add-btn').forEach(btn => {
				btn.addEventListener('click', () => {
					const listId = btn.dataset.list;
					const type = btn.dataset.type || 'string';
					if (type === 'kv') {
						document.getElementById(listId + '-list').insertAdjacentHTML('beforeend', kvRowHTML('', ''));
					} else {
						document.getElementById(listId + '-list').insertAdjacentHTML('beforeend',
							stringListItemHTML(''));
					}
					markDirty();
					bindRemoveEvents();
				});
			});
			bindRemoveEvents();
			const auToggle = document.getElementById('au-enabled');
			if (auToggle) {
				auToggle.addEventListener('change', () => {
					document.getElementById('au-fields').style.display = auToggle.checked ? 'block' : 'none';
					markDirty();
				});
			}
		}

		function bindRemoveEvents() {
			container.querySelectorAll('.remove-btn').forEach(btn => {
				btn.onclick = () => { btn.closest('.list-item, .kv-row').remove(); markDirty(); };
			});
		}

		function section(title, content) {
			return '<div class="section"><label class="section-label">' + title + '</label>' + content + '</div>';
		}

		function input(id, type, value, required, placeholder) {
			return '<input id="' + id + '" type="' + type + '" class="form-input" value="' + esc(value) + '"' +
				(required ? ' required' : '') + (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + '/>';
		}

		function inputGroup(label, id, type, value, required) {
			return '<div class="input-group"><label class="input-label">' + label + '</label>' + input(id, type, value, required) + '</div>';
		}

		function row(html) { return '<div class="row">' + html + '</div>'; }

		function stringList(id, items) {
			const rows = items.map(i => stringListItemHTML(i)).join('');
			return '<div id="' + id + '-list" class="list-container">' + rows + '</div>' +
				'<button type="button" class="form-button secondary add-btn" data-list="' + id + '">' +
					'<span class="codicon codicon-add"></span> Add</button>';
		}

		function stringListItemHTML(value) {
			return '<div class="list-item">' +
				'<input type="text" class="form-input" value="' + esc(value) + '"/>' +
				'<button type="button" class="remove-btn icon-btn" title="Remove"><span class="remove-x"></span></button>' +
			'</div>';
		}

		function kvList(id, rows) {
			return '<div id="' + id + '-list" class="list-container">' + rows + '</div>' +
				'<button type="button" class="form-button secondary add-btn" data-list="' + id + '" data-type="kv">' +
					'<span class="codicon codicon-add"></span> Add Param</button>';
		}

		function kvRowHTML(key, value) {
			return '<div class="kv-row">' +
				'<input type="text" class="form-input kv-key" placeholder="Key" value="' + esc(key) + '"/>' +
				'<input type="text" class="form-input kv-val" placeholder="Value" value="' + esc(value) + '"/>' +
				'<button type="button" class="remove-btn icon-btn" title="Remove"><span class="remove-x"></span></button>' +
			'</div>';
		}

		function esc(s) {
			if (s == null) return '';
			return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
		}

		function showMessage(text, kind) {
			messageBar.textContent = text;
			messageBar.className = 'message-bar ' + kind;
			messageBar.style.display = 'block';
			clearTimeout(showMessage._timer);
			showMessage._timer = setTimeout(() => { messageBar.style.display = 'none'; }, 5000);
		}
		showMessage._timer = null;

		window.addEventListener('message', event => {
			const msg = event.data;
			if (msg.type === 'init') {
				if (msg.error) {
					container.innerHTML = '<p class="placeholder-text">' + esc(msg.error) + '</p>';
					currentMeta = null;
					btnSave.disabled = true;
					btnValidate.disabled = true;
					return;
				}
				currentMeta = msg.meta;
				renderForm(msg.meta);
				btnValidate.disabled = false;
			} else if (msg.type === 'saveResult') {
				if (msg.ok) {
					dirty = false;
					btnSave.disabled = true;
					showMessage('Saved successfully', 'success');
				} else {
					showMessage(msg.error, 'error');
				}
			} else if (msg.type === 'validateResult') {
				btnValidate.disabled = false;
				btnValidate.innerHTML = '<span class="codicon codicon-check-all"></span> Validate';
				if (msg.success) {
					showMessage(msg.message, 'success');
				} else {
					showMessage(msg.message, 'error');
				}
			}
		});

		vscode.postMessage({ type: 'ready' });
	</script>
</body>
</html>`;
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
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body {
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-sideBar-foreground);
			background: var(--vscode-sideBar-background);
			padding: 8px;
		}

		.editor-header {
			display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
		}
		.editor-header .codicon { font-size: 14px; color: var(--vscode-descriptionForeground); }
		.editor-title { font-weight: 600; font-size: 13px; flex: 1; }
		.editor-actions { display: flex; gap: 4px; }

		.form-container { padding-bottom: 16px; }
		.placeholder-text { text-align: center; padding: 32px 16px; color: var(--vscode-descriptionForeground); }

		.section { margin-bottom: 12px; }
		.section-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--vscode-descriptionForeground); margin-bottom: 4px; letter-spacing: 0.5px; }

		.form-input {
			width: 100%; padding: 4px 8px;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-input-foreground);
			background: var(--vscode-input-background);
			border: 1px solid var(--vscode-input-border);
			border-radius: 2px; outline: none;
		}
		.form-input:focus { border-color: var(--vscode-focusBorder); }

		.row { display: flex; gap: 8px; }
		.row .input-group { flex: 1; }
		.input-label { display: block; font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 2px; }

		.list-container { display: flex; flex-direction: column; gap: 4px; margin-bottom: 4px; }
		.list-item { display: flex; gap: 4px; }
		.list-item .form-input { flex: 1; }

		.kv-row { display: flex; gap: 4px; }
		.kv-row .kv-key { width: 40%; }
		.kv-row .kv-val { flex: 1; }

		.icon-btn {
			background: none; border: none; cursor: pointer; padding: 4px 6px;
			color: var(--vscode-descriptionForeground); border-radius: 2px;
			display: flex; align-items: center; justify-content: center; flex-shrink: 0;
		}
		.icon-btn:hover { background: var(--vscode-list-hoverBackground); color: var(--vscode-sideBar-foreground); }

		.remove-x {
			position: relative; width: 12px; height: 12px; display: block;
		}
		.remove-x::before, .remove-x::after {
			content: ''; position: absolute; left: 50%; top: 50%;
			width: 12px; height: 2px; background: currentColor; border-radius: 1px;
		}
		.remove-x::before { transform: translate(-50%, -50%) rotate(45deg); }
		.remove-x::after { transform: translate(-50%, -50%) rotate(-45deg); }

		.check-grid { display: flex; flex-direction: column; gap: 4px; }
		.check-label { font-size: 12px; display: flex; align-items: center; gap: 4px; cursor: pointer; }
		.check-label input { margin: 0; }

		.sub-fields { padding-left: 12px; border-left: 2px solid var(--vscode-widget-border); margin-top: 4px; }

		.message-bar {
			padding: 6px 8px; margin-bottom: 8px; border-radius: 2px;
			font-size: 12px; word-break: break-word;
		}
		.message-bar.success {
			color: var(--vscode-terminal-ansiGreen);
			background: color-mix(in srgb, var(--vscode-terminal-ansiGreen) 15%, transparent);
		}
		.message-bar.error {
			color: var(--vscode-errorForeground);
			background: color-mix(in srgb, var(--vscode-errorForeground) 15%, transparent);
		}

		.form-button {
			padding: 4px 10px;
			font-family: var(--vscode-font-family);
			font-size: 12px;
			color: var(--vscode-button-foreground);
			background: var(--vscode-button-background);
			border: none; border-radius: 2px;
			cursor: pointer; display: inline-flex; align-items: center; gap: 3px;
		}
		.form-button:hover { background: var(--vscode-button-hoverBackground); }
		.form-button:disabled { opacity: 0.4; cursor: default; }
		.form-button:disabled:hover { background: var(--vscode-button-background); }
		.form-button.secondary {
			color: var(--vscode-button-secondaryForeground);
			background: var(--vscode-button-secondaryBackground);
		}
		.form-button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
		.form-button .codicon { font-size: 13px; }
	`;
}
