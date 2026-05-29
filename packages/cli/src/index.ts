import { main } from "./cli.js";

process.on("uncaughtException", (err) => {
  process.stderr.write(`[uncaughtException] ${err?.stack ?? err}\n`);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  process.stderr.write(`[unhandledRejection] ${(reason as Error)?.stack ?? reason}\n`);
  process.exit(1);
});

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    process.stderr.write(`[main rejected] ${err?.stack ?? err}\n`);
    process.exit(1);
  },
);
