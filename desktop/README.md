# Clout City for Steam (desktop app)

A desktop window around the live game, with Steam sign-in. The full story is in `docs/STEAM.md`.

```sh
npm install                        # Electron, electron-builder, steamworks.js
npm start                          # opens https://cloutcity.app/ (steam.json "url")
CLOUT_CITY_URL=http://localhost:3000/ npm start   # against `npm run dev` in the repo root

# Before a release build, copy the Steamworks SDK's redistributables (never committed):
#   sdk/redistributable_bin/win64/steam_api64.dll   -> redist/win64/
#   sdk/redistributable_bin/osx/libsteam_api.dylib  -> redist/osx/
npm run build:win                  # dist/win-unpacked/CloutCity.exe
npm run build:mac                  # dist/mac/Clout City.app (sign and notarize before uploading)
npm run build:linux                # dist/linux-unpacked/CloutCity
```

- **`steam.json`:** the App ID (480 is Valve's test app until ours exists) and the game's address.
- **Running outside Steam:** a release build relaunches itself through Steam. In development, Steam must be running for
  sign-in. Without it, the window still opens and the start page says Steam sign-in didn't work.
- **Uploading:** upload `dist/*-unpacked` (or `dist/mac`) as the depot with SteamPipe. Set the launch option to the
  executable.
