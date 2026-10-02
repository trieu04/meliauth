import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUserId } from "../auth/decorators/current-user-id.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from "./dto/user-admin.dto";
import { AdminGuard } from "./guards/admin.guard";
import { UsersService } from "./users.service";

@ApiTags("Users (Admin)")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, AdminGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOkResponse({ description: "Paginated users" })
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(":id")
  @ApiOkResponse({ description: "User details" })
  find(@Param("id", ParseIntPipe) id: number) {
    return this.users.find(id);
  }

  @Post()
  @ApiCreatedResponse({ description: "User created" })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(":id")
  @ApiOkResponse({ description: "User updated" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUserId() actorId: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(id, actorId, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiNoContentResponse({ description: "User deleted" })
  remove(@Param("id", ParseIntPipe) id: number, @CurrentUserId() actorId: number) {
    return this.users.remove(id, actorId);
  }
}
