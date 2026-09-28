#!/usr/bin/env node
import { jalankanCli } from "./cli.js";

Promise.resolve(jalankanCli(process.argv.slice(2))).then((kode) => process.exit(kode));
