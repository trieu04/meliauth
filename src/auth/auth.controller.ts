import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import type { AppConfig } from "../config/configuration";
import { CurrentUserId } from "./decorators/current-user-id.decorator";
import { ForgotPasswordDto, GoogleSignInDto, LoginDto, MessageResponseDto, RefreshDto, RegisterDto, ResetPasswordDto, SendVerificationDto, TokenResponseDto, UpdateProfileDto, UserResponseDto, VerifyDto } from "./dto/auth.dto";
import { AccessTokenGuard } from "./guards/access-token.guard";
import { AuthService } from "./services/auth.service";
import { CookieService } from "./services/cookie.service";
import { TokenService } from "./services/token.service";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly cookies: CookieService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Post("register")
  @ApiCreatedResponse({ type: TokenResponseDto })
  async register(@Body() dto: RegisterDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.respondWithTokens(await this.auth.register(dto, this.metadata(request)), response);
  }

  @Post("login")
  @HttpCode(200)
  @ApiOkResponse({ type: TokenResponseDto })
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.respondWithTokens(await this.auth.login(dto, this.metadata(request)), response);
  }

  @Post("forgot-password")
  @HttpCode(200)
  @ApiOperation({ summary: "Send a one-time 8-digit password reset code by email" })
  @ApiOkResponse({ type: MessageResponseDto })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post("reset-password")
  @HttpCode(200)
  @ApiOperation({ summary: "Set a new password using an 8-digit reset code" })
  @ApiOkResponse({ type: MessageResponseDto })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post("verification/send")
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Send a one-time 6-digit email verification code" })
  @ApiOkResponse({ type: MessageResponseDto })
  sendVerification(@CurrentUserId() userId: number, @Body() dto: SendVerificationDto) {
    void dto.method;
    return this.auth.sendEmailVerification(userId);
  }

  @Post("verification/verify")
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Verify the current user's email with a 6-digit code" })
  @ApiOkResponse({ type: MessageResponseDto })
  verify(@CurrentUserId() userId: number, @Body() dto: VerifyDto) {
    return this.auth.verifyEmail(userId, dto);
  }

  @Post("oauth/google")
  @HttpCode(200)
  @ApiOkResponse({ type: TokenResponseDto })
  async google(@Body() dto: GoogleSignInDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.respondWithTokens(await this.auth.googleSignIn(dto, this.metadata(request)), response);
  }

  @Post("refresh")
  @HttpCode(200)
  @ApiOkResponse({ type: TokenResponseDto })
  async refresh(@Body() dto: RefreshDto = {}, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = dto.refreshToken ?? this.refreshCookie(request);
    if (!refreshToken) throw new UnauthorizedException("Refresh token is required");
    return this.respondWithTokens(await this.tokens.rotate(refreshToken, this.metadata(request)), response);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto = {}, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = dto.refreshToken ?? this.refreshCookie(request);
    if (refreshToken) await this.tokens.revoke(refreshToken);
    this.cookies.clear(response);
  }

  @Get("info")
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponseDto })
  me(@CurrentUserId() userId: number) {
    return this.auth.info(userId);
  }

  @Patch("info")
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponseDto })
  updateMe(@CurrentUserId() userId: number, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(userId, dto);
  }

  private respondWithTokens<T extends { accessToken: string; refreshToken: string }>(result: T, response: Response): T {
    this.cookies.set(response, result.accessToken, result.refreshToken);
    return result;
  }

  private refreshCookie(request: Request): string | undefined {
    const name = this.config.get("cookie.refreshName", { infer: true });
    return (request.cookies as Record<string, string> | undefined)?.[name];
  }

  private metadata(request: Request) {
    return {
      userAgent: request.get("user-agent")?.slice(0, 512) ?? null,
      ipAddress: request.ip?.slice(0, 64) ?? null,
    };
  }
}
