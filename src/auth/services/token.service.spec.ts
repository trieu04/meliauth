import { generateKeyPairSync } from "node:crypto";
import { JwtService } from "@nestjs/jwt";
import type { ConfigService } from "@nestjs/config";
import type { Repository } from "typeorm";
import type { AppConfig } from "../../config/configuration";
import type { RefreshClaims } from "../auth.types";
import type { RefreshSession } from "../../entities/refresh-session.entity";
import { User } from "../../entities/user.entity";
import { TokenService } from "./token.service";

describe("TokenService", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const jwtConfig = {
    privateKey,
    publicKey,
    keyId: "test-key",
    issuer: "https://auth.test",
    audience: ["api.test"],
    accessTtl: "15m" as const,
    refreshTtl: "30d" as const,
  };
  const jwt = new JwtService({
    privateKey,
    publicKey,
    signOptions: { algorithm: "RS256", issuer: jwtConfig.issuer, audience: jwtConfig.audience, keyid: jwtConfig.keyId },
    verifyOptions: { algorithms: ["RS256"], issuer: jwtConfig.issuer, audience: "api.test" },
  });
  const saved: RefreshSession[] = [];
  let nextSessionId = 1;
  const repository = {
    create: (value: RefreshSession) => value,
    save: async (value: RefreshSession) => {
      if (!value.id) value.id = nextSessionId++;
      const index = saved.findIndex((session) => session.id === value.id);
      if (index === -1) saved.push(value);
      else saved[index] = value;
      return value;
    },
  } as unknown as Repository<RefreshSession>;
  const config = {
    get: (key: string) => key === "jwt" ? jwtConfig : undefined,
  } as unknown as ConfigService<AppConfig, true>;
  const service = new TokenService(jwt, config, repository);
  const user = Object.assign(new User(), {
    id: 100,
    username: "demo",
    displayName: "Demo User",
    avatarUrl: null,
    roles: [],
    email: null,
    phoneNumber: null,
  });

  beforeEach(() => {
    saved.splice(0);
    nextSessionId = 1;
  });

  it("issues independently verifiable RS256 access and refresh tokens", async () => {
    const result = await service.issue(user, { userAgent: "jest", ipAddress: "127.0.0.1" });
    const access = await service.verifyAccess(result.accessToken);
    const refresh = await jwt.verifyAsync<RefreshClaims>(result.refreshToken);

    expect(access).toMatchObject({ sub: user.id, type: "access", username: "demo", roles: [] });
    expect(refresh).toMatchObject({ sub: user.id, jti: 1, type: "refresh" });
    expect(result.expiresIn).toBe(900);
    expect(saved).toHaveLength(1);
    expect(saved[0].tokenHash).not.toContain(result.refreshToken);
  });

  it("publishes a public-only JWKS with the configured kid", () => {
    const jwk = service.getJwks().keys[0];
    expect(jwk).toMatchObject({ kty: "RSA", kid: "test-key", alg: "RS256", use: "sig" });
    expect(jwk).not.toHaveProperty("d");
  });
});
