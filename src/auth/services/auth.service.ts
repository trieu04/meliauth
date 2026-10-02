import { createHash, randomInt } from "node:crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import ms from "ms";
import { DataSource, In, IsNull, Repository } from "typeorm";
import type { AppConfig } from "../../config/configuration";
import { MailService } from "../../mail/mail.service";
import type { RequestMetadata } from "../auth.types";
import type { ForgotPasswordDto, GoogleSignInDto, LoginDto, RegisterDto, ResetPasswordDto, UpdateProfileDto, VerifyDto } from "../dto/auth.dto";
import { Credential } from "../../entities/credential.entity";
import { EmailVerificationToken } from "../../entities/email-verification-token.entity";
import { OAuthAccount } from "../../entities/oauth-account.entity";
import { PasswordResetToken } from "../../entities/password-reset-token.entity";
import { User } from "../../entities/user.entity";
import { normalizePhoneNumber, phoneLoginCandidates, storedPhoneCandidates } from "../phone-number";
import { TokenService } from "./token.service";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Credential) private readonly credentials: Repository<Credential>,
    @InjectRepository(OAuthAccount) private readonly oauthAccounts: Repository<OAuthAccount>,
    @InjectRepository(PasswordResetToken) private readonly passwordResetTokens: Repository<PasswordResetToken>,
    @InjectRepository(EmailVerificationToken) private readonly emailVerificationTokens: Repository<EmailVerificationToken>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto, metadata: RequestMetadata) {
    const username = dto.username.trim().toLowerCase();
    const email = dto.email?.trim().toLowerCase() || null;
    const phoneNumber = dto.phoneNumber ? this.requirePhoneNumber(dto.phoneNumber) : null;
    await this.assertUsernameAvailable(username);
    if (phoneNumber) await this.assertPhoneNumberAvailable(phoneNumber);

    const user = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(User, manager.create(User, {
        username,
        displayName: dto.displayName.trim(),
        avatarUrl: dto.avatarUrl ?? null,
        roles: [],
        email,
        phoneNumber,
      }));
      await manager.save(Credential, manager.create(Credential, {
        userId: created.id,
        passwordHash: await bcrypt.hash(dto.password, 12),
      }));
      return created;
    });
    return this.tokens.issue(user, metadata);
  }

  async login(dto: LoginDto, metadata: RequestMetadata) {
    const identifier = dto.identifier.trim().toLowerCase();
    const phoneCandidates = phoneLoginCandidates(identifier);
    if (phoneCandidates !== null && phoneCandidates.length === 0) {
      throw new BadRequestException("Invalid phone number");
    }
    const user = await this.users.findOne({
      where: phoneCandidates !== null
        ? { phoneNumber: In(phoneCandidates) }
        : identifier.includes("@")
          ? { email: identifier }
          : { username: identifier },
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const credential = await this.credentials.createQueryBuilder("credential")
      .addSelect("credential.passwordHash")
      .where("credential.userId = :userId", { userId: user.id })
      .getOne();
    if (!credential || !(await bcrypt.compare(dto.password, credential.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.tokens.issue(user, metadata);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    this.mail.assertConfigured();
    const email = dto.email.trim().toLowerCase();
    const user = await this.users.findOneBy({ email });
    if (!user) throw new NotFoundException("No account found for this email");

    const reset = this.config.get("passwordReset", { infer: true });
    const ttlMilliseconds = ms(reset.ttl);
    const code = randomInt(0, 100_000_000).toString().padStart(8, "0");
    const token = await this.dataSource.transaction(async (manager) => {
      await manager.update(PasswordResetToken, { userId: user.id, usedAt: IsNull() }, { usedAt: new Date() });
      return manager.save(PasswordResetToken, manager.create(PasswordResetToken, {
        userId: user.id,
        tokenHash: this.hash(code),
        expiresAt: new Date(Date.now() + ttlMilliseconds),
        usedAt: null,
      }));
    });

    try {
      await this.mail.sendPasswordResetCode(email, user.displayName, code, Math.ceil(ttlMilliseconds / 60_000));
    } catch (error) {
      await this.passwordResetTokens.delete(token.id);
      throw error;
    }
    return { message: "Password reset code has been sent." };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hash(dto.code);
    const token = await this.passwordResetTokens.findOne({
      where: { tokenHash, usedAt: IsNull() },
      relations: { user: true },
    });
    if (!token || token.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("Invalid or expired password reset code");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const changed = await this.dataSource.transaction(async (manager) => {
      const consumed = await manager.update(PasswordResetToken, { id: token.id, usedAt: IsNull() }, { usedAt: new Date() });
      if (consumed.affected !== 1) return false;

      const credential = await manager.findOneBy(Credential, { userId: token.userId });
      await manager.save(Credential, credential
        ? Object.assign(credential, { passwordHash })
        : manager.create(Credential, { userId: token.userId, passwordHash }));
      return true;
    });
    if (!changed) throw new BadRequestException("Invalid or expired password reset code");
    return { message: "Password has been reset successfully." };
  }

  async sendEmailVerification(userId: number) {
    this.mail.assertConfigured();
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");
    if (!user.email) throw new BadRequestException("User does not have an email address");
    if (user.emailVerified) throw new BadRequestException("Email is already verified");

    const verification = this.config.get("emailVerification", { infer: true });
    const ttlMilliseconds = ms(verification.ttl);
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const token = await this.dataSource.transaction(async (manager) => {
      await manager.update(EmailVerificationToken, { userId, usedAt: IsNull() }, { usedAt: new Date() });
      return manager.save(EmailVerificationToken, manager.create(EmailVerificationToken, {
        userId,
        email: user.email!,
        tokenHash: this.hash(code),
        expiresAt: new Date(Date.now() + ttlMilliseconds),
        usedAt: null,
      }));
    });

    try {
      await this.mail.sendEmailVerificationCode(user.email, user.displayName, code, Math.ceil(ttlMilliseconds / 60_000));
    } catch (error) {
      await this.emailVerificationTokens.delete(token.id);
      throw error;
    }
    return { message: "Email verification code has been sent." };
  }

  async verifyEmail(userId: number, dto: VerifyDto) {
    const token = await this.emailVerificationTokens.findOneBy({
      userId,
      tokenHash: this.hash(dto.code),
      usedAt: IsNull(),
    });
    if (!token || token.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("Invalid or expired email verification code");
    }

    const verified = await this.dataSource.transaction(async (manager) => {
      const consumed = await manager.update(EmailVerificationToken, { id: token.id, usedAt: IsNull() }, { usedAt: new Date() });
      if (consumed.affected !== 1) return false;
      const updated = await manager.update(User, { id: userId, email: token.email, emailVerified: false }, { emailVerified: true });
      return updated.affected === 1;
    });
    if (!verified) throw new BadRequestException("Email address has changed or is already verified");
    return { message: "Email has been verified successfully." };
  }

  async googleSignIn(dto: GoogleSignInDto, metadata: RequestMetadata) {
    const clientId = this.config.get("googleClientId", { infer: true });
    if (!clientId) throw new ServiceUnavailableException("Google OAuth is not configured");
    let ticket;
    try {
      ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: dto.idToken, audience: clientId });
    } catch {
      throw new UnauthorizedException("Invalid Google ID token");
    }
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new UnauthorizedException("Google account must have a verified email");
    }

    let account = await this.oauthAccounts.findOne({
      where: { provider: "google", providerSubject: payload.sub },
      relations: { user: true },
    });
    if (account) {
      return this.tokens.issue(account.user, metadata);
    }

    const email = payload.email.toLowerCase();
    let user = await this.users.findOneBy({ email });
    if (!user) {
      const username = await this.availableUsername(email.split("@")[0] ?? "user");
      user = await this.users.save(this.users.create({
        username,
        displayName: payload.name || username,
        avatarUrl: payload.picture || null,
        roles: [],
        email,
        emailVerified: true,
        phoneNumber: null,
        phoneNumberVerified: false,
      }));
    } else if (!user.emailVerified) {
      user.emailVerified = true;
      user = await this.users.save(user);
    }
    account = await this.oauthAccounts.save(this.oauthAccounts.create({
      userId: user.id,
      provider: "google",
      providerSubject: payload.sub,
    }));
    return this.tokens.issue(user, metadata);
  }

  async info(userId: number) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");
    return this.tokens.publicUser(user);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");
    const email = dto.email === undefined ? user.email : dto.email?.trim().toLowerCase() || null;
    const phoneNumber = dto.phoneNumber === undefined
      ? user.phoneNumber
      : dto.phoneNumber
        ? this.requirePhoneNumber(dto.phoneNumber)
        : null;
    if (phoneNumber && phoneNumber !== user.phoneNumber) await this.assertPhoneNumberAvailable(phoneNumber);

    if (dto.displayName !== undefined) user.displayName = dto.displayName.trim();
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
    if (email !== user.email) {
      user.email = email;
      user.emailVerified = false;
    }
    if (phoneNumber !== user.phoneNumber) {
      user.phoneNumber = phoneNumber;
      user.phoneNumberVerified = false;
    }
    return this.tokens.publicUser(await this.users.save(user));
  }

  private async assertUsernameAvailable(username: string) {
    if (await this.users.findOneBy({ username })) throw new ConflictException("Username already exists");
  }

  private async assertPhoneNumberAvailable(phoneNumber: string) {
    if (await this.users.findOneBy({ phoneNumber: In(storedPhoneCandidates(phoneNumber)) })) {
      throw new ConflictException("Phone number already exists");
    }
  }

  private requirePhoneNumber(value: string): string {
    const normalized = normalizePhoneNumber(value);
    if (!normalized) throw new BadRequestException("Invalid phone number");
    return normalized;
  }

  private async availableUsername(raw: string): Promise<string> {
    const base = raw.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 48) || "user";
    let candidate = base.length >= 3 ? base : `${base}user`;
    let suffix = 0;
    while (await this.users.findOneBy({ username: candidate })) {
      suffix += 1;
      candidate = `${base.slice(0, 48)}-${suffix}`;
    }
    return candidate;
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
