import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest } from "../guards/access-token.guard";

export const CurrentUserId = createParamDecorator((_data: unknown, context: ExecutionContext): number => {
  return context.switchToHttp().getRequest<AuthenticatedRequest>().auth.sub;
});
