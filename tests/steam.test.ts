import { test } from "node:test";
import assert from "node:assert/strict";
import { STEAM_IDENTITY, steamConfig, steamEmail, validTicket, verifySteamTicket } from "../lib/steam.ts";

const cfg = { appId: "480", key: "SECRET" };
const ticket = "14000000".repeat(8);
const reply = (status: number, body: unknown) => async () => ({ ok: status < 400, status, json: async () => body });

test("Steam is set up only with a numeric App ID and a key", () => {
  assert.equal(steamConfig({}), null);
  assert.equal(steamConfig({ STEAM_APP_ID: "abc", STEAM_WEB_API_KEY: "k" }), null);
  assert.deepEqual(steamConfig({ STEAM_APP_ID: " 480 ", STEAM_WEB_API_KEY: "k" }), { appId: "480", key: "k" });
});

test("tickets are hex of a sane length", () => {
  assert.ok(validTicket(ticket));
  assert.ok(!validTicket("zz".repeat(20)));
  assert.ok(!validTicket("ab"));
  assert.ok(!validTicket(ticket + "a"));
  assert.ok(!validTicket(42));
});

test("a good ticket gives the Steam id; the request names our app and identity", async () => {
  let asked = "";
  const r = await verifySteamTicket(ticket, cfg, async (url) => {
    asked = url;
    return { ok: true, status: 200, json: async () => ({ response: { params: { result: "OK", steamid: "76561197960287930", ownersteamid: "76561197960287930" } } }) };
  });
  assert.deepEqual(r, { ok: true, steamId: "76561197960287930" });
  assert.match(asked, /partner\.steam-api\.com\/ISteamUserAuth\/AuthenticateUserTicket\/v1\//);
  assert.match(asked, /appid=480/);
  assert.match(asked, new RegExp(`identity=${STEAM_IDENTITY}`));
});

test("bad, banned and unreachable", async () => {
  assert.deepEqual(await verifySteamTicket(ticket, null, reply(200, {})), { ok: false, error: "not_set_up" });
  assert.deepEqual(await verifySteamTicket("nope", cfg, reply(200, {})), { ok: false, error: "bad_ticket" });
  assert.deepEqual(await verifySteamTicket(ticket, cfg, reply(200, { response: { error: { errorcode: 101 } } })), { ok: false, error: "bad_ticket" });
  assert.deepEqual(await verifySteamTicket(ticket, cfg, reply(200, { response: { params: { result: "OK", steamid: "76561197960287930", publisherbanned: true } } })), { ok: false, error: "banned" });
  assert.deepEqual(await verifySteamTicket(ticket, cfg, reply(503, {})), { ok: false, error: "steam_down" });
  assert.deepEqual(await verifySteamTicket(ticket, cfg, async () => { throw new Error("offline"); }), { ok: false, error: "steam_down" });
});

test("Steam-made accounts are stored under an address nobody mails", () => {
  assert.equal(steamEmail("76561197960287930"), "steam-76561197960287930@users.cloutcity.app");
});

test("Steam checkout: item ids, order ids, prices in the wallet's currency", async () => {
  const { steamItemId, newOrderId, steamPrice, steamSession } = await import("../lib/steam.ts");
  assert.equal(steamItemId("chat_forever"), steamItemId("chat_forever"));
  assert.notEqual(steamItemId("chat_forever"), steamItemId("vip_month"));
  assert.ok(steamItemId("x") > 0 && steamItemId("x") < 2 ** 32);
  const id = newOrderId(1_800_000_000_000, () => 0.5);
  assert.equal(id, "1800000000000500");
  assert.ok(Number.isSafeInteger(Number(id)));
  assert.equal(steamSession(id), "steam:1800000000000500");
  const rates = { EUR: 0.95, GBP: 0.8 };
  assert.equal(steamPrice(1999, "usd", rates), 1999);
  assert.equal(steamPrice(1999, "EUR", rates), 1899); // 18.99 → rounded up to .99
  assert.equal(steamPrice(499, "GBP", rates), 399);
  assert.equal(steamPrice(1999, "JPY", rates), null);
});

test("Steam checkout: the order Steam is sent, and its answers", async () => {
  const { initTxn, finalizeTxn, steamWallet, steamItemId } = await import("../lib/steam.ts");
  let url = "", sent: URLSearchParams | null = null;
  const ok = async (u: string, b: URLSearchParams) => { url = u; sent = b; return { ok: true, status: 200, json: async () => ({ response: { result: "OK", params: { orderid: "1", transid: "9" } } }) }; };
  const r = await initTxn(cfg, { orderId: "1", steamId: "76561197960287930", sku: "chat_forever", name: "Chat forever", amount: 11999, currency: "usd" }, true, ok);
  assert.deepEqual(r, { ok: true, params: { orderid: "1", transid: "9" } });
  assert.match(url, /ISteamMicroTxnSandbox\/InitTxn\/v3\//);
  assert.equal(sent!.get("itemid[0]"), String(steamItemId("chat_forever")));
  assert.equal(sent!.get("amount[0]"), "11999");
  assert.equal(sent!.get("currency"), "USD");
  assert.equal(sent!.get("usersession"), "client");
  const fin = await finalizeTxn(cfg, "1", false, async (u) => { url = u; return { ok: true, status: 200, json: async () => ({ response: { result: "Failure", error: { errordesc: "Order not approved" } } }) }; });
  assert.deepEqual(fin, { ok: false, error: "Order not approved" });
  assert.match(url, /\/ISteamMicroTxn\/FinalizeTxn\/v2\//);
  assert.deepEqual(await steamWallet(cfg, "76561197960287930", false, reply(200, { response: { result: "OK", params: { currency: "EUR", status: "Active" } } })), { ok: true, currency: "EUR" });
  assert.deepEqual(await steamWallet(cfg, "76561197960287930", false, reply(200, { response: { result: "OK", params: { currency: "EUR", status: "Locked" } } })), { ok: false, error: "wallet_locked" });
});
