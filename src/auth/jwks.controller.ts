import { Controller, Get, Header } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { TokenService } from "./services/token.service";

@ApiExcludeController()
@Controller(".well-known")
export class JwksController {
  constructor(private readonly tokens: TokenService) {}

  @Get("jwks.json")
  @Header("Cache-Control", "public, max-age=300")
  jwks() {
    return this.tokens.getJwks();
  }
}
