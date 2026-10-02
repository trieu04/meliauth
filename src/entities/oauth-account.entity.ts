import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { User } from "./user.entity";

@Entity("oauth_accounts")
@Unique(["provider", "providerSubject"])
export class OAuthAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "user_id", type: "integer" })
  userId: number;

  @ManyToOne(() => User, (user) => user.oauthAccounts, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ type: "varchar", length: 32 })
  provider: string;

  @Column({ name: "provider_subject", type: "varchar", length: 255 })
  providerSubject: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
