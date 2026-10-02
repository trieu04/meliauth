import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { User } from "./user.entity";

@Entity("credentials")
@Unique(["userId"])
export class Credential {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "user_id", type: "integer" })
  userId: number;

  @OneToOne(() => User, (user) => user.credential, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "password_hash", type: "varchar", length: 255, select: false })
  passwordHash: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
