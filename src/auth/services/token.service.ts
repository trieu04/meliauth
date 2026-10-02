import { createHash, createPublicKey, timingSafeEqual } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import ms from "ms";
import { IsNull, Repository } from "typeorm";
import type { AppConfig } from "../../config/configuration";
import type { AccessClaims, RefreshClaims, RequestMetadata } from "../auth.types";
import { RefreshSession } from "../../entities/refresh-session.entity";
import { User } from "../../entities/user.entity";

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    @InjectRepository(RefreshSession) private readonly sessions: Repository<RefreshSession>,
  ) {}

  async issue(user: User, metadata: RequestMetadata) {
    const accessToken = await this.signAccess(user);
    const session = await this.sessions.save(this.sessions.create({
      userId: user.id,
      tokenHash: "0".repeat(64),
      expiresAt: new Date(Date.now() + this.refreshTtlMilliseconds),
      revokedAt: null,
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
    }));
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: session.id, type: "refresh" } satisfies RefreshClaims,
      { expiresIn: this.jwtConfig.refreshTtl },
    );
    const decoded = this.jwt.decode<RefreshClaims>(refreshToken);

    session.tokenHash = this.hash(refreshToken);
    session.expiresAt = new Date((decoded.exp ?? 0) * 1000);
    await this.sessions.save(session);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTtlSeconds,
      user: this.publicUser(user),
    };
  }

  async rotate(refreshToken: string, metadata: RequestMetadata) {
    const claims = await this.verifyRefresh(refreshToken);
    const session = await this.sessions.createQueryBuilder("session")
      .addSelect("session.tokenHash")
      .leftJoinAndSelect("session.user", "user")
      .where("session.id = :id", { id: claims.jti })
      .getOne();

    if (!session || session.userId !== claims.sub || !this.hashMatches(refreshToken, session.tokenHash)) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (session.revokedAt) {
      await this.sessions.update({ userId: session.userId, revokedAt: IsNull() }, { revokedAt: new Date() });
      throw new UnauthorizedException("Refresh token reuse detected; all sessions were revoked");
    }
    if (session.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException("Refresh token expired");
    const rotated = await this.sessions.update({ id: session.id, revokedAt: IsNull() }, { revokedAt: new Date() });
    if (rotated.affected !== 1) {
      await this.sessions.update({ userId: session.userId, revokedAt: IsNull() }, { revokedAt: new Date() });
      throw new UnauthorizedException("Refresh token reuse detected; all sessions were revoked");
    }
    return this.issue(session.user, metadata);
  }

  async revoke(refreshToken: string): Promise<void> {
    try {
      const claims = await this.verifyRefresh(refreshToken);
      const session = await this.sessions.createQueryBuilder("session")
        .addSelect("session.tokenHash")
        .where("session.id = :id", { id: claims.jti })
        .getOne();
      if (session && this.hashMatches(refreshToken, session.tokenHash) && !session.revokedAt) {
        session.revokedAt = new Date();
        await this.sessions.save(session);
      }
    } catch {
      // Logout is idempotent; invalid/expired tokens still result in cleared cookies.
    }
  }

  async verifyAccess(token: string): Promise<AccessClaims> {
    try {
      const payload = await this.jwt.verifyAsync<AccessClaims>(token);
      if (payload.type !== "access") throw new Error("Wrong token type");
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }

  getJwks() {
    const key = createPublicKey(this.jwtConfig.publicKey).export({ format: "jwk" });
    return { keys: [{ ...key, kid: this.jwtConfig.keyId, use: "sig", alg: "RS256" }] };
  }

  publicUser(user: User) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      roles: user.roles ?? [],
      email: user.email,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber,
      phoneNumberVerified: user.phoneNumberVerified,
    };
  }

  private async signAccess(user: User): Promise<string> {
    return this.jwt.signAsync({
      sub: user.id,
      type: "access",
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      roles: user.roles ?? [],
      email: user.email,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber,
      phoneNumberVerified: user.phoneNumberVerified,
    } satisfies AccessClaims, { expiresIn: this.jwtConfig.accessTtl });
  }

  private async verifyRefresh(token: string): Promise<RefreshClaims> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshClaims>(token);
      if (payload.type !== "refresh" || !payload.jti) throw new Error("Wrong token type");
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private hashMatches(token: string, expected: string): boolean {
    const actual = Buffer.from(this.hash(token));
    const stored = Buffer.from(expected);
    return actual.length === stored.length && timingSafeEqual(actual, stored);
  }

  private get jwtConfig() {
    return this.config.get("jwt", { infer: true });
  }

  get accessTtlSeconds(): number {
    return Math.floor(ms(this.jwtConfig.accessTtl) / 1000);
  }

  get refreshTtlMilliseconds(): number {
    return ms(this.jwtConfig.refreshTtl);
  }
}
