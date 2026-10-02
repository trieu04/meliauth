import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import type { AppConfig } from "../config/configuration";
import { MailModule } from "../mail/mail.module";
import { AuthController } from "./auth.controller";
import { Credential } from "../entities/credential.entity";
import { EmailVerificationToken } from "../entities/email-verification-token.entity";
import { OAuthAccount } from "../entities/oauth-account.entity";
import { PasswordResetToken } from "../entities/password-reset-token.entity";
import { RefreshSession } from "../entities/refresh-session.entity";
import { User } from "../entities/user.entity";
import { AccessTokenGuard } from "./guards/access-token.guard";
import { JwksController } from "./jwks.controller";
import { AuthService } from "./services/auth.service";
import { CookieService } from "./services/cookie.service";
import { TokenService } from "./services/token.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Credential, RefreshSession, OAuthAccount, PasswordResetToken, EmailVerificationToken]),
    MailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const jwt = config.get("jwt", { infer: true });
        const audience = jwt.audience as [string, ...string[]];
        return {
          privateKey: jwt.privateKey,
          publicKey: jwt.publicKey,
          signOptions: {
            algorithm: "RS256" as const,
            issuer: jwt.issuer,
            audience,
            keyid: jwt.keyId,
          },
          verifyOptions: {
            algorithms: ["RS256" as const],
            issuer: jwt.issuer,
            audience,
          },
        };
      },
    }),
  ],
  controllers: [AuthController, JwksController],
  providers: [AuthService, TokenService, CookieService, AccessTokenGuard],
  exports: [TokenService, AccessTokenGuard],
})
export class AuthModule {}
