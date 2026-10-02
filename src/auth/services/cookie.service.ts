import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import type { AppConfig } from "../../config/configuration";
import { TokenService } from "./token.service";

@Injectable()
export class CookieService {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly tokens: TokenService,
  ) {}

  set(response: Response, accessToken: string, refreshToken: string): void {
    const cookie = this.config.get("cookie", { infer: true });
    for (const domain of cookie.domains) {
      const common = { httpOnly: true, secure: cookie.secure, sameSite: cookie.sameSite, domain };
      response.cookie(cookie.accessName, accessToken, {
        ...common,
        path: "/",
        maxAge: this.tokens.accessTtlSeconds * 1000,
      });
      response.cookie(cookie.refreshName, refreshToken, {
        ...common,
        path: "/",
        maxAge: this.tokens.refreshTtlMilliseconds,
      });
    }
  }

  clear(response: Response): void {
    const cookie = this.config.get("cookie", { infer: true });
    for (const domain of cookie.domains) {
      const common = { httpOnly: true, secure: cookie.secure, sameSite: cookie.sameSite, domain, path: "/" };
      response.clearCookie(cookie.accessName, common);
      response.clearCookie(cookie.refreshName, common);
    }
  }
}
