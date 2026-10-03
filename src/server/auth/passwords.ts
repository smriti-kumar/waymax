import "server-only";
import bcrypt from "bcryptjs";

const COST = 10;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// A real hash of a random string, compared against when the email is unknown so
// login timing doesn't reveal which emails have accounts.
export const DUMMY_HASH = "$2b$10$eF8T///aqwSwTVbfYxf37uhJfsEaI242zBM5D0xn5ENipu/25oIHW";
