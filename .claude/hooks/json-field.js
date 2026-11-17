#!/usr/bin/env node
// Lit le JSON du hook sur stdin et écrit la valeur de chaque champ demandé
// (passé en argument), une par ligne, dans l'ordre des arguments.
// Remplace la dépendance à `jq`, absent de cette machine.
let raw = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stderr.write("json-field: entrée JSON invalide\n");
    process.exit(1);
  }

  for (const field of process.argv.slice(2)) {
    const value = payload?.[field];
    process.stdout.write((value === undefined || value === null ? "" : String(value)) + "\n");
  }
});