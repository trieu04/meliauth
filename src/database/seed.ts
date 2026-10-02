import "dotenv/config";
import bcrypt from "bcrypt";
import { Credential } from "../entities/credential.entity";
import { User } from "../entities/user.entity";
import { AppDataSource } from "./data-source";

const ADMIN_ID = 1;
const SEEDED_USER_IDS = Array.from({ length: 10 }, (_, index) => 51 + index);
const FIRST_REGULAR_USER_ID = 101;

async function seed() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD must contain at least 8 characters");
  }
  const userPassword = process.env.SEED_USER_PASSWORD;
  if (!userPassword || userPassword.length < 6) {
    throw new Error("SEED_USER_PASSWORD must contain at least 6 characters");
  }

  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  const userPasswordHash = await bcrypt.hash(userPassword, 12);

  await AppDataSource.initialize();
  await AppDataSource.transaction(async (manager) => {
    let admin = await manager.findOneBy(User, { id: ADMIN_ID });
    if (!admin) {
      const username = (process.env.SEED_ADMIN_USERNAME ?? "admin").trim().toLowerCase();
      const conflictingUsername = await manager.findOneBy(User, { username });
      if (conflictingUsername) {
        throw new Error(`Cannot seed admin: username '${username}' already belongs to user ${conflictingUsername.id}`);
      }
      admin = await manager.save(User, manager.create(User, {
        id: ADMIN_ID,
        username,
        displayName: (process.env.SEED_ADMIN_DISPLAY_NAME ?? "Administrator").trim(),
        email: process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || null,
        emailVerified: false,
        phoneNumber: null,
        phoneNumberVerified: false,
        avatarUrl: null,
        roles: ["admin"],
      }));
    } else if (admin.username !== (process.env.SEED_ADMIN_USERNAME ?? "admin").trim().toLowerCase()) {
      throw new Error(`Cannot seed admin: user ID ${ADMIN_ID} already exists as '${admin.username}'`);
    }

    const credential = await manager.createQueryBuilder(Credential, "credential")
      .addSelect("credential.passwordHash")
      .where("credential.userId = :userId", { userId: admin.id })
      .getOne();
    if (!credential) {
      await manager.save(Credential, manager.create(Credential, {
        userId: admin.id,
        passwordHash: adminPasswordHash,
      }));
    }

    for (const id of SEEDED_USER_IDS) {
      const username = `user${id}`;
      let user = await manager.findOneBy(User, { id });
      if (!user) {
        const conflictingUsername = await manager.findOneBy(User, { username });
        if (conflictingUsername) {
          throw new Error(`Cannot seed user: username '${username}' already belongs to user ${conflictingUsername.id}`);
        }
        await manager.query(
          `INSERT INTO "users" ("id", "username", "display_name") VALUES ($1, $2, $3)`,
          [id, username, `User ${id}`],
        );
        user = await manager.findOneByOrFail(User, { id });
      } else if (user.username !== username) {
        throw new Error(`Cannot seed user ID ${id}: it already belongs to '${user.username}'`);
      }

      const userCredential = await manager.findOneBy(Credential, { userId: user.id });
      if (!userCredential) {
        await manager.save(Credential, manager.create(Credential, {
          userId: user.id,
          passwordHash: userPasswordHash,
        }));
      }
    }

    await manager.query(
      `SELECT setval(
        pg_get_serial_sequence('users', 'id'),
        GREATEST(
          COALESCE(MAX(id), 0) + 1,
          $1,
          (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM users_id_seq)
        ),
        false
      ) FROM users`,
      [FIRST_REGULAR_USER_ID],
    );
  });
  await AppDataSource.destroy();
  console.log(
    `Seeded admin user ID ${ADMIN_ID} and users ${SEEDED_USER_IDS[0]}-${SEEDED_USER_IDS.at(-1)}; `
    + `next user ID is at least ${FIRST_REGULAR_USER_ID}.`,
  );
}

seed().catch(async (error: unknown) => {
  console.error(error);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exitCode = 1;
});
