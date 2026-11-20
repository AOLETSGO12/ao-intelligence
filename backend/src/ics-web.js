// Browser build of the .ics reader (used to read an uploaded calendar file on the device).
// Rebuild:  cd /workspace/tools && ./node_modules/.bin/esbuild <site>/backend/src/ics-web.js --bundle --format=iife --global-name=AOIcs --target=es2018 --outfile=<site>/js/ics.js
export { parseIcs, windowFor } from "./ics.js";
