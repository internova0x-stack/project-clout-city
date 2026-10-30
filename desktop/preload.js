// The only bridge between the game page and Steam (contextIsolation and the sandbox stay on): the page can ask for a
// Steam Web API ticket (sign-in, components/SteamBridge.tsx), the player's Steam name, and Steam's answer to a checkout
// order (GameShell's buy). Nothing else reaches Node.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cloutSteam", {
  ticket: () => ipcRenderer.invoke("steam:ticket"),
  name: () => ipcRenderer.invoke("steam:name"),
  authorized: (orderId) => ipcRenderer.invoke("steam:authorized", String(orderId)),
});
