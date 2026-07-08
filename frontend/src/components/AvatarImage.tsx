import { PH_USER_IMAGE } from "../constants";
import type { UserProfile } from "../types";

export default function AvatarImage({
  user,
  size = "small",
}: {
  user: Pick<UserProfile, "name" | "avatarUrl">;
  size?: "small" | "large";
}) {
  return (
    <img
      className={`avatar-image ${size === "large" ? "large" : ""}`}
      src={user.avatarUrl || PH_USER_IMAGE}
      alt={`${user.name} avatar`}
    />
  );
}
