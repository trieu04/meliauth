import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { AppConfig } from "../../config/configuration";
import type { AccessClaims } from "../auth.types";
import { TokenService } from "../services/token.service";

export type AuthenticatedRequest = Request & { auth: AccessClaims };

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const bearer = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const cookieName = this.config.get("cookie.accessName", { infer: true });
    const token = bearer ?? (request.cookies as Record<string, string> | undefined)?.[cookieName];
    if (!token) throw new UnauthorizedException("Access token is required");
    request.auth = await this.tokens.verifyAccess(token);
    return true;
  }
}
