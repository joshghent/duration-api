#!/usr/bin/env node

import { startServer } from "./server";

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "serve" || !command) {
    let port = 3000;

    const portIdx = args.indexOf("--port");
    if (portIdx !== -1 && args[portIdx + 1]) {
      const parsed = parseInt(args[portIdx + 1], 10);
      if (!isNaN(parsed)) port = parsed;
    }

    const shortIdx = args.indexOf("-p");
    if (shortIdx !== -1 && args[shortIdx + 1]) {
      const parsed = parseInt(args[shortIdx + 1], 10);
      if (!isNaN(parsed)) port = parsed;
    }

    startServer(port);
  } else if (command === "--help" || command === "-h") {
    console.log(`Usage: durationapi [command] [options]

Commands:
  serve   Start the API server (default)

Options:
  --port, -p  Port to listen on (default: 3000)
  --help, -h  Show this help message`);
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

main();
