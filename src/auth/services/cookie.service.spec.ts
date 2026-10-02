import type { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import type { AppConfig } from "../../config/configuration";
import { CookieService } from "./cookie.service";
import type { TokenService } from "./token.service";

describe("CookieService", () => {
  it("sets access and refresh cookies for every configured domain", () => {
    const cookie = jest.fn();
    const response = { cookie } as unknown as Response;
    const config = {
      get: () => ({
        domains: [".example.com", ".example.org"],
        accessName: "access",
        refreshName: "refresh",
        secure: true,
        sameSite: "lax",
      }),
    } as unknown as ConfigService<AppConfig, true>;
    const tokens = { accessTtlSeconds: 900, refreshTtlMilliseconds: 2_592_000_000 } as TokenService;

    new CookieService(config, tokens).set(response, "access-token", "refresh-token");

    expect(cookie).toHaveBeenCalledTimes(4);
    expect(cookie).toHaveBeenCalledWith("access", "access-token", expect.objectContaining({ domain: ".example.com", httpOnly: true }));
    expect(cookie).toHaveBeenCalledWith("refresh", "refresh-token", expect.objectContaining({ domain: ".example.org", secure: true }));
  });
});
