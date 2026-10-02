import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { Credential } from "../entities/credential.entity";
import { User } from "../entities/user.entity";
import { AdminGuard } from "./guards/admin.guard";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [TypeOrmModule.forFeature([User, Credential]), AuthModule],
  controllers: [UsersController],
  providers: [UsersService, AdminGuard],
})
export class UsersModule {}
