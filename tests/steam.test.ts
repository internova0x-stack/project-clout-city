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
