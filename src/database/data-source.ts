import "dotenv/config";
import { DataSource } from "typeorm";
import { Credential } from "../entities/credential.entity";
import { EmailVerificationToken } from "../entities/email-verification-token.entity";
import { PasswordResetToken } from "../entities/password-reset-token.entity";
import { OAuthAccount } from "../entities/oauth-account.entity";
import { RefreshSession } from "../entities/refresh-session.entity";
import { User } from "../entities/user.entity";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? "meliauth",
  password: process.env.DB_PASSWORD ?? "meliauth",
  database: process.env.DB_NAME ?? "meliauth",
  ssl: process.env.DB_SSL?.toLowerCase() === "true" ? { rejectUnauthorized: false } : false,
  synchronize: true,
  entities: [User, Credential, OAuthAccount, RefreshSession, PasswordResetToken, EmailVerificationToken],
});
