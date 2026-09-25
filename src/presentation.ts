export function errorPage(
  message: string,
  allowExternal: boolean,
  nonce: string,
): string {
  const escaped = message.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"><style nonce="${nonce}">body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:24px;max-width:650px}button{font:inherit;margin:8px 8px 0 0;padding:8px 12px;color:var(--vscode-button-foreground);background:var(--vscode-button-background);border:0;cursor:pointer}button:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:2px}p{line-height:1.6}</style></head><body><h1>Google Files</h1><p role="status">${escaped}</p><button id="retry">Retry</button>${allowExternal ? '<button id="external">Open in External Browser</button>' : ""}<script nonce="${nonce}">const api=acquireVsCodeApi();for(const id of ['retry','external']){document.getElementById(id)?.addEventListener('click',()=>api.postMessage({action:id}));}</script></body></html>`;
}
