// Prints the 'city' settings seed (JSON) from lib/city.ts, for a migration.
// Usage: node --experimental-strip-types scripts/gen-city-seed.ts
import { citySeed } from "../lib/city.ts";
process.stdout.write(JSON.stringify(citySeed()));
