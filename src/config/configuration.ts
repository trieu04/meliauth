import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CookieOptions } from "express";
import type { StringValue } from "ms";

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  return value === undefined ? fallback : value.toLowerCase() === "true";
}

function list(name: string): string[] {
  return (process.env[name] ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function pem(name: string, pathName: string): string {
  const inline = process.env[name]?.replace(/\\n/g, "\n");
  if (inline) return inline;
  const path = process.env[pathName];
  if (!path) throw new Error(`${name} or ${pathName} is required`);
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

export interface AppConfig {
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize: boolean;
    ssl: boolean;
  };
  jwt: {
    privateKey: string;
    publicKey: string;
    keyId: string;
    issuer: string;
    audience: string[];
    accessTtl: StringValue;
    refreshTtl: StringValue;
  };
  cookie: {
    domains: Array<string | undefined>;
    accessName: string;
    refreshName: string;
    secure: boolean;
    sameSite: CookieOptions["sameSite"];
  };
  mail: {
    host?: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    from: string;
  };
  passwordReset: {
    ttl: StringValue;
  };
  emailVerification: {
    ttl: StringValue;
  };
  googleClientId?: string;
}

export default (): AppConfig => ({
  port: Number(process.env.PORT ?? 3000),
  apiPrefix: process.env.API_PREFIX ?? "api/v1",
  corsOrigins: list("CORS_ORIGINS"),
  database: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? "meliauth",
    password: process.env.DB_PASSWORD ?? "meliauth",
    database: process.env.DB_NAME ?? "meliauth",
    synchronize: true,
    ssl: bool("DB_SSL", false),
  },
  jwt: {
    privateKey: pem("JWT_PRIVATE_KEY", "JWT_PRIVATE_KEY_PATH"),
    publicKey: pem("JWT_PUBLIC_KEY", "JWT_PUBLIC_KEY_PATH"),
    keyId: process.env.JWT_KEY_ID ?? "meliauth-default",
    issuer: process.env.JWT_ISSUER ?? "meliauth",
    audience: list("JWT_AUDIENCE").length ? list("JWT_AUDIENCE") : ["meliauth-services"],
    accessTtl: (process.env.JWT_ACCESS_TTL ?? "15m") as StringValue,
    refreshTtl: (process.env.JWT_REFRESH_TTL ?? "30d") as StringValue,
  },
  cookie: {
    domains: list("COOKIE_DOMAINS").length ? list("COOKIE_DOMAINS") : [undefined],
    accessName: process.env.COOKIE_ACCESS_NAME ?? "meliauth_access",
    refreshName: process.env.COOKIE_REFRESH_NAME ?? "meliauth_refresh",
    secure: bool("COOKIE_SECURE", process.env.NODE_ENV === "production"),
    sameSite: (process.env.COOKIE_SAME_SITE ?? "lax") as CookieOptions["sameSite"],
  },
  mail: {
    host: process.env.SMTP_HOST || undefined,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: bool("SMTP_SECURE", false),
    user: process.env.SMTP_USER || undefined,
    password: process.env.SMTP_PASSWORD || undefined,
    from: process.env.MAIL_FROM ?? "MeliAuth <no-reply@example.com>",
  },
  passwordReset: {
    ttl: (process.env.PASSWORD_RESET_TTL ?? "15m") as StringValue,
  },
  emailVerification: {
    ttl: (process.env.EMAIL_VERIFICATION_TTL ?? "15m") as StringValue,
  },
  googleClientId: process.env.GOOGLE_CLIENT_ID || undefined,
});
