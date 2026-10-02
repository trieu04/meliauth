import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./user.entity";

@Entity("email_verification_tokens")
@Index(["userId", "tokenHash"])
export class EmailVerificationToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "user_id", type: "integer" })
  userId: number;

  @ManyToOne(() => User, (user) => user.emailVerificationTokens, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ type: "varchar", length: 320 })
  email: string;

  @Column({ name: "token_hash", type: "char", length: 64 })
  tokenHash: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @Column({ name: "used_at", type: "timestamptz", nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
