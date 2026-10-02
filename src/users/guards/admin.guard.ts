import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../../entities/user.entity";
import type { AuthenticatedRequest } from "../../auth/guards/access-token.guard";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.users.findOneBy({ id: request.auth.sub });
    if (!user || !user.roles.includes("admin")) {
      throw new ForbiddenException("Admin role is required");
    }
    return true;
  }
}
