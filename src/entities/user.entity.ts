import { Column, CreateDateColumn, Entity, Index, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Credential } from "./credential.entity";
import { OAuthAccount } from "./oauth-account.entity";
import { PasswordResetToken } from "./password-reset-token.entity";
import { EmailVerificationToken } from "./email-verification-token.entity";
import { RefreshSession } from "./refresh-session.entity";

@Entity("users")
@Index(["username"], { unique: true })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 64 })
  username: string;

  @Column({ name: "display_name", type: "varchar", length: 120 })
  displayName: string;

  @Column({ name: "avatar_url", type: "varchar", length: 2048, nullable: true })
  avatarUrl: string | null;

  @Column({ type: "text", array: true, default: () => "ARRAY[]::text[]" })
  roles: string[];

  @Column({ type: "varchar", length: 320, nullable: true })
  email: string | null;

  @Column({ name: "email_verified", type: "boolean", default: false })
  emailVerified: boolean;

  @Column({ name: "phone_number", type: "varchar", length: 32, nullable: true })
  phoneNumber: string | null;

  @Column({ name: "phone_verified", type: "boolean", default: false })
  phoneNumberVerified: boolean;

  @OneToOne(() => Credential, (credential) => credential.user)
  credential?: Credential | null;

  @OneToMany(() => OAuthAccount, (account) => account.user)
  oauthAccounts?: OAuthAccount[];

  @OneToMany(() => RefreshSession, (session) => session.user)
  refreshSessions?: RefreshSession[];

  @OneToMany(() => PasswordResetToken, (token) => token.user)
  passwordResetTokens?: PasswordResetToken[];

  @OneToMany(() => EmailVerificationToken, (token) => token.user)
  emailVerificationTokens?: EmailVerificationToken[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
