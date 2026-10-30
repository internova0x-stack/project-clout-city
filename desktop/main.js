// Clout City for Steam (owner, Oct 30; docs/STEAM.md). A desktop window around the live game at cloutcity.app, with
// the Steam client behind it: sign-in with Steam (a Web API ticket the server checks), the Steam overlay and Steam
// checkout. The game itself isn't bundled: the window loads the site, so every update ships the moment the
// site deploys and Steam builds only change when this wrapper does.
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const config = require("./steam.json");

const APP_ID = Number(process.env.STEAM_APP_ID || config.appId);
const GAME_URL = process.env.CLOUT_CITY_URL || config.url;
const GAME_ORIGIN = new URL(GAME_URL).origin;
// The identity the server checks tickets against (lib/steam.ts STEAM_IDENTITY).
const IDENTITY = "cloutcity";

let steamworks = null;
let client = null;
try {
  steamworks = require("steamworks.js");
  // Launched outside Steam in a release build: Steam relaunches it properly and this copy quits.
  if (app.isPackaged && steamworks.restartAppIfNecessary(APP_ID)) app.exit(0);
  else client = steamworks.init(APP_ID);
} catch (e) {
  console.error("Steam isn't running, or steamworks.js is missing:", e);
}

ipcMain.handle("steam:ticket", async () => {
  if (!client) throw new Error("steam_unavailable");
  const ticket = await client.auth.getAuthTicketForWebApi(IDENTITY);
  return Buffer.from(ticket.getBytes()).toString("hex");
});
ipcMain.handle("steam:name", () => (client ? client.localplayer.getName() : ""));

// Steam checkout (docs/STEAM.md): the server starts an order, Steam shows it in the overlay, and Steam's answer comes
// back here. The page waits for its order's answer (steam:authorized); unanswered after 15 minutes counts as cancelled.
const answers = new Map(); // order id → approved, for answers that arrive before the page asks
const waiting = new Map(); // order id → resolve
if (client && steamworks) {
  client.callback.register(steamworks.SteamCallback.MicroTxnAuthorizationResponse, (r) => {
    if (r.app_id !== APP_ID) return;
    const id = String(r.order_id);
    const resolve = waiting.get(id);
    if (resolve) { waiting.delete(id); resolve(!!r.authorized); } else answers.set(id, !!r.authorized);
  });
}
ipcMain.handle("steam:authorized", (_e, orderId) => {
  const id = String(orderId);
  if (!/^[0-9]{1,19}$/.test(id)) return false;
  if (answers.has(id)) { const a = answers.get(id); answers.delete(id); return a; }
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    setTimeout(() => { if (waiting.delete(id)) resolve(false); }, 15 * 60 * 1000);
  });
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: "Clout City",
    backgroundColor: "#14111A",
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);
  win.webContents.setUserAgent(`${win.webContents.getUserAgent()} CloutCitySteam/${app.getVersion()}`);

  // The window only ever shows the game; anything else (Terms links, help) opens in the player's browser.
  const external = (url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); };
  win.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => {
    if (new URL(url).origin !== GAME_ORIGIN) { e.preventDefault(); external(url); }
  });

  // F11 toggles fullscreen, like most PC games.
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type === "keyDown" && input.key === "F11") { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });

  win.loadURL(GAME_URL);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());

// The Steam overlay (Shift+Tab) needs this at the end of the main file (steamworks.js README).
if (steamworks) steamworks.electronEnableSteamOverlay();
