import type { User } from "@/types";

export type UserRole = User["role"];

export function isAdminRole(role: UserRole | string | null | undefined) {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdminRole(role: UserRole | string | null | undefined) {
  return role === "super_admin";
}

export function canAccessAdmin(user: Pick<User, "role"> | null | undefined) {
  return isAdminRole(user?.role);
}
