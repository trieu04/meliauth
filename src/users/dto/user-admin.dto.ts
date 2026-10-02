import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEmail, IsInt, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

export class CreateUserDto {
  @ApiProperty({ example: "nguyenvana" })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,64}$/)
  username: string;

  @ApiPropertyOptional({ example: "Nguyễn Văn A" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string | null;

  @ApiPropertyOptional({ example: "+84901234567", type: String })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string | null;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  roles?: string[];
}

export class UpdateUserDto extends PartialType(CreateUserDto) { }

export class ListUsersQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ description: "Search username, display name, email, or phone" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
