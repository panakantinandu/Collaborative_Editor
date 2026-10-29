import type { User } from "@/lib/types";
export function Avatar({ user, small = false }: { user: User; small?: boolean }) { return <span className={`avatar ${small ? "avatar-small" : ""}`} style={{ backgroundColor: user.avatarColor }} title={user.name}>{user.name.slice(0, 1)}</span>; }
