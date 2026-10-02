import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Equals, IsEmail, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "nguyenvana" })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,64}$/)
  username: string;

  @ApiProperty({ example: "Nguyễn Văn A" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional({ example: "+84901234567" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string;
}

export class LoginDto {
  @ApiProperty({ description: "Username, email, or phone number. Vietnamese national numbers are normalized to +84." })
  @IsString()
  @MinLength(1)
  identifier: string;

  @ApiProperty()
  @IsString()
  password: string;
}

export class RefreshDto {
  @ApiPropertyOptional({ description: "Optional when refresh cookie is present" })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  @MaxLength(320)
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: "8-digit code received by email", example: "01234567" })
  @IsString()
  @Matches(/^\d{8}$/)
  code: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

export class SendVerificationDto {
  @ApiProperty({ enum: ["email"], example: "email" })
  @Equals("email")
  method: "email";
}

export class VerifyDto extends SendVerificationDto {
  @ApiProperty({ description: "6-digit code received by email", example: "012345" })
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}

export class MessageResponseDto {
  @ApiProperty()
  message: string;
}

export class GoogleSignInDto {
  @ApiProperty({ description: "Google OpenID Connect ID token" })
  @IsString()
  idToken: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: "+84901234567" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneNumber?: string | null;
}

export class UserResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() username: string;
  @ApiProperty() displayName: string;
  @ApiProperty({ nullable: true, type: String }) avatarUrl: string | null;
  @ApiProperty({ type: [String], default: [] }) roles: string[];
  @ApiProperty({ nullable: true, type: String }) email: string | null;
  @ApiProperty() emailVerified: boolean;
  @ApiProperty({ nullable: true, type: String }) phoneNumber: string | null;
  @ApiProperty() phoneNumberVerified: boolean;
}

export class TokenResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
  @ApiProperty() expiresIn: number;
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
}
