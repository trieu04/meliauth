import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const directory = resolve(process.cwd(), "keys");
if (!existsSync(directory)) mkdirSync(directory, { recursive: true, mode: 0o700 });

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 3072,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

writeFileSync(resolve(directory, "private.pem"), privateKey, { mode: 0o600 });
writeFileSync(resolve(directory, "public.pem"), publicKey, { mode: 0o644 });
console.log("Generated keys/private.pem and keys/public.pem (RSA 3072-bit)");
