import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import bcrypt from "bcrypt";
import { Brackets, DataSource, In, Repository } from "typeorm";
import { Credential } from "../entities/credential.entity";
import { User } from "../entities/user.entity";
import { normalizePhoneNumber, storedPhoneCandidates } from "../auth/phone-number";
import { TokenService } from "../auth/services/token.service";
import type { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from "./dto/user-admin.dto";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly tokens: TokenService,
  ) {}

  async list(query: ListUsersQueryDto) {
    const builder = this.users.createQueryBuilder("user");
    if (query.search?.trim()) {
      builder.andWhere(new Brackets((where) => {
        where.where("user.username ILIKE :search")
          .orWhere("user.displayName ILIKE :search")
          .orWhere("user.email ILIKE :search")
          .orWhere("user.phoneNumber ILIKE :search");
      }), { search: `%${query.search.trim()}%` });
    }
    const [users, total] = await builder
      .orderBy("user.id", "ASC")
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return {
      data: users.map((user) => this.adminUser(user)),
      meta: { page: query.page, limit: query.limit, total, pageCount: Math.ceil(total / query.limit) },
    };
  }

  async find(id: number) {
    return this.adminUser(await this.getUser(id));
  }

  async create(dto: CreateUserDto) {
    const values = this.normalized(dto);
    await this.assertUsernameAvailable(values.username);
    if (values.phoneNumber) await this.assertPhoneNumberAvailable(values.phoneNumber);
    const user = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(User, manager.create(User, {
        ...values,
        roles: this.normalizeRoles(dto.roles),
      }));
      await manager.save(Credential, manager.create(Credential, {
        userId: created.id,
        passwordHash: await bcrypt.hash(dto.password, 12),
      }));
      return created;
    });
    return this.adminUser(user);
  }

  async update(id: number, actorId: number, dto: UpdateUserDto) {
    const user = await this.getUser(id);
    const username = dto.username === undefined ? user.username : dto.username.trim().toLowerCase();
    const email = dto.email === undefined ? user.email : dto.email?.trim().toLowerCase() || null;
    const phoneNumber = dto.phoneNumber === undefined ? user.phoneNumber : this.optionalPhoneNumber(dto.phoneNumber);
    await this.assertUsernameAvailable(username, id);
    if (phoneNumber && phoneNumber !== user.phoneNumber) await this.assertPhoneNumberAvailable(phoneNumber, id);

    const nextRoles = dto.roles === undefined ? user.roles : this.normalizeRoles(dto.roles);
    if (id === actorId && !nextRoles.includes("admin")) {
      throw new BadRequestException("An admin cannot remove its own admin role");
    }
    if (id === 1 && !nextRoles.includes("admin")) {
      throw new BadRequestException("The seeded admin must keep the admin role");
    }

    await this.dataSource.transaction(async (manager) => {
      user.username = username;
      if (email !== user.email) {
        user.email = email;
        user.emailVerified = false;
      }
      if (phoneNumber !== user.phoneNumber) {
        user.phoneNumber = phoneNumber;
        user.phoneNumberVerified = false;
      }
      if (dto.displayName !== undefined) user.displayName = dto.displayName.trim();
      if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
      user.roles = nextRoles;
      await manager.save(user);
      if (dto.password !== undefined) {
        const passwordHash = await bcrypt.hash(dto.password, 12);
        const credential = await manager.findOneBy(Credential, { userId: id });
        if (credential) {
          credential.passwordHash = passwordHash;
          await manager.save(credential);
        } else {
          await manager.save(Credential, manager.create(Credential, { userId: id, passwordHash }));
        }
      }
    });
    return this.adminUser(user);
  }

  async remove(id: number, actorId: number): Promise<void> {
    if (id === 1) throw new BadRequestException("The seeded admin cannot be deleted");
    if (id === actorId) throw new BadRequestException("An admin cannot delete itself");
    const result = await this.users.delete(id);
    if (result.affected !== 1) throw new NotFoundException("User not found");
  }

  private async getUser(id: number): Promise<User> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  private normalized(dto: CreateUserDto) {
    return {
      username: dto.username.trim().toLowerCase(),
      displayName: dto.displayName.trim(),
      avatarUrl: dto.avatarUrl ?? null,
      email: dto.email?.trim().toLowerCase() || null,
      phoneNumber: this.optionalPhoneNumber(dto.phoneNumber),
    };
  }

  private normalizeRoles(roles: string[] | undefined): string[] {
    return [...new Set((roles ?? []).map((role) => role.trim().toLowerCase()).filter(Boolean))];
  }

  private async assertUsernameAvailable(username: string, exceptId?: number) {
    const existing = await this.users.findOneBy({ username });
    if (existing && existing.id !== exceptId) throw new ConflictException("Username already exists");
  }

  private async assertPhoneNumberAvailable(phoneNumber: string, exceptId?: number) {
    const existing = await this.users.findOneBy({ phoneNumber: In(storedPhoneCandidates(phoneNumber)) });
    if (existing && existing.id !== exceptId) throw new ConflictException("Phone number already exists");
  }

  private optionalPhoneNumber(value: string | null | undefined): string | null {
    if (!value) return null;
    const normalized = normalizePhoneNumber(value);
    if (!normalized) throw new BadRequestException("Invalid phone number");
    return normalized;
  }

  private adminUser(user: User) {
    return { ...this.tokens.publicUser(user), createdAt: user.createdAt, updatedAt: user.updatedAt };
  }
}
