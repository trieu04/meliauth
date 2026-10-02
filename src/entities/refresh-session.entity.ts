import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./user.entity";

@Entity("refresh_sessions")
@Index(["userId"])
export class RefreshSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "user_id", type: "integer" })
  userId: number;

  @ManyToOne(() => User, (user) => user.refreshSessions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "token_hash", type: "char", length: 64, select: false })
  tokenHash: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt: Date | null;

  @Column({ name: "user_agent", type: "varchar", length: 512, nullable: true })
  userAgent: string | null;

  @Column({ name: "ip_address", type: "varchar", length: 64, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
