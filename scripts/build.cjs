// Build the GitHub Pages version from the Artifact's published HTML.
// usage: node build.cjs <artifact.html> <out/index.html> [enc.json]
const fs = require("fs");
const [src, out, encPath] = process.argv.slice(2);
let h = fs.readFileSync(src, "utf8");
const ENC = encPath ? fs.readFileSync(encPath, "utf8").trim() : "null";
const must = (from, to) => { if (!h.includes(from)) throw new Error("not found: " + from.slice(0, 60)); h = h.replace(from, to); };

const layer = `<meta name="robots" content="noindex,nofollow">
<style>
.editbtn { margin-left: auto; font: inherit; font-size: 12px; font-weight: 700; color: #fff; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.7); border-radius: 999px; padding: 4px 12px; cursor: pointer; white-space: nowrap; }
.editbtn:hover { background: rgba(255,255,255,.28); }
.editbtn[aria-pressed="true"] { background: #fff; color: #0c6b77; }
dialog.pw { border: 1px solid var(--line); border-radius: 12px; background: var(--surface); color: var(--ink); padding: 18px; width: min(340px, calc(100vw - 32px)); }
dialog.pw::backdrop { background: rgba(0,0,0,.45); }
dialog.pw form { display: grid; gap: 10px; }
dialog.pw input { font: inherit; font-size: 16px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); }
dialog.pw .row { display: flex; gap: 8px; justify-content: flex-end; }
dialog.pw button { font: inherit; font-weight: 700; padding: 6px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
dialog.pw button[value="ok"] { background: var(--accent); border-color: var(--accent); color: #fff; }
dialog.pw .err { color: var(--bad); font-size: 13px; min-height: 1em; margin: 0; }
</style>
<script>
// 公開版：データは data.json（このリポジトリ）から読み、パスワードで編集を解除すると
// GitHub API で data.json を書き換える（トークンはパスワードで暗号化して埋め込み）。
(() => {
  const REPO = "oshironaoki-lab/makishi-carnival-dashboard", FILE = "data.json";
  const ENC = ${ENC};
  const MC = window.MC = { months: {}, cb: null, err: null, token: null };
  const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const b64e = bytes => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const api = (path, opt = {}) => fetch("https://api.github.com/repos/" + REPO + path, { ...opt, cache: "no-store", headers: { Authorization: "Bearer " + MC.token, Accept: "application/vnd.github+json", ...(opt.headers || {}) } });
  const emit = () => MC.cb && MC.cb({ docs: Object.keys(MC.months).map(id => ({ id, exists: true, data: () => MC.months[id] })) });
  async function readRemote() {
    const r = await api("/contents/" + FILE + "?ref=main");
    if (!r.ok) throw { code: "read-" + r.status };
    const j = await r.json();
    return { sha: j.sha, data: JSON.parse(new TextDecoder().decode(b64d(j.content.replace(/\\n/g, "")))) };
  }
  async function load() {
    if (MC.token) { try { MC.months = (await readRemote()).data; emit(); return; } catch (_) {} }
    const r = await fetch(FILE + "?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("load " + r.status);
    MC.months = await r.json(); emit();
  }
  async function save(id, fields) {
    if (!MC.token) throw { code: "パスワード未入力" };
    for (let attempt = 0; attempt < 3; attempt++) {
      const { sha, data } = await readRemote();
      data[id] = { ...(data[id] || {}), ...fields };
      const body = JSON.stringify({ message: id + " を更新（" + Object.keys(fields).join("・") + "）", content: b64e(new TextEncoder().encode(JSON.stringify(data, null, 1) + "\\n")), sha, branch: "main" });
      const r = await api("/contents/" + FILE, { method: "PUT", body });
      if (r.ok) { MC.months = data; emit(); return; }
      if (r.status !== 409 && r.status !== 422) throw { code: "save-" + r.status };
    }
    throw { code: "同時に更新されました。もう一度お試しください" };
  }
  async function unlock(pw) {
    const salt = b64d(ENC.s), iv = b64d(ENC.i), ct = b64d(ENC.c);
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ENC.n, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    MC.token = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
  }
  MC.unlock = async pw => { await unlock(pw); try { sessionStorage.setItem("mc-pw", pw); } catch (_) {} await load(); };
  MC.lock = () => { MC.token = null; try { sessionStorage.removeItem("mc-pw"); } catch (_) {} };
  MC.ready = (async () => { let pw = null; try { pw = sessionStorage.getItem("mc-pw"); } catch (_) {} if (pw && ENC) { try { await unlock(pw); } catch (_) { MC.lock(); } } })();
  window.claude = { use: async n => {
    await MC.ready;
    if (n === "user") return { canEdit: async () => !!MC.token };
    if (n !== "db") return null;
    return {
      collection: () => ({ onSnapshot: (cb, err) => { MC.cb = cb; load().catch(e => err && err(e)); } }),
      doc: path => ({ update: fields => save(path.split("/").pop(), fields) })
    };
  } };
})();
</script>
`;
const i = h.indexOf("<script>");
h = h.slice(0, i) + layer + h.slice(i);

must(`<span class="status" id="asof"></span>`,
  `<span class="status" id="asof"></span>
        <button type="button" class="editbtn" id="editBtn" aria-pressed="false">🔒 編集する</button>`);
must(`let DB = null, canEdit = false;`,
  `let DB = null, canEdit = false;
  window.MC_setEdit = v => { canEdit = v; const b = document.getElementById("editBtn"); if (b) { b.setAttribute("aria-pressed", v ? "true" : "false"); b.textContent = v ? "✎ 編集中（終了）" : "🔒 編集する"; } if (DB && Object.keys(months).length) render(); };`);
must(`try { const user = await window.claude.use("user"); canEdit = user ? await user.canEdit() : false; } catch (_) { canEdit = false; }`,
  `try { const user = await window.claude.use("user"); canEdit = user ? await user.canEdit() : false; } catch (_) { canEdit = false; }
    window.MC_setEdit(canEdit);`);
// password dialog + button wiring (appended before </body>)
must(`</body></html>`, `<dialog class="pw" id="pwDlg"><form method="dialog" id="pwForm">
  <strong>編集用パスワード</strong>
  <span style="font-size:13px;color:var(--muted)">目標・キャンペーン・暦を入力・変更できるようになります。</span>
  <input type="password" id="pwIn" autocomplete="current-password" aria-label="パスワード">
  <p class="err" id="pwErr"></p>
  <div class="row"><button value="cancel" formnovalidate>やめる</button><button value="ok" id="pwOk">編集を始める</button></div>
</form></dialog>
<script>
(() => {
  const dlg = document.getElementById("pwDlg"), inp = document.getElementById("pwIn"), err = document.getElementById("pwErr");
  document.getElementById("editBtn").addEventListener("click", () => {
    if (window.MC.token) { window.MC.lock(); window.MC_setEdit(false); return; }
    err.textContent = ""; inp.value = ""; dlg.showModal(); inp.focus();
  });
  document.getElementById("pwForm").addEventListener("submit", async e => {
    if (e.submitter && e.submitter.value === "cancel") return;
    e.preventDefault(); err.textContent = "確認しています…";
    try { await window.MC.unlock(inp.value); dlg.close(); window.MC_setEdit(true); }
    catch (_) { window.MC.lock(); err.textContent = "パスワードが違います。"; }
  });
})();
</script>
</body></html>`);
fs.writeFileSync(out, h);
console.log("ok", h.length);
