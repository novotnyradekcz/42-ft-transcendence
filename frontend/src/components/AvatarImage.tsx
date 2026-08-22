// A user's avatar, in one of two sizes. Used by every list and profile screen.

import { PH_USER_IMAGE } from "../constants";
import type { UserProfile } from "../types";

// avatarUrl carries the image itself as a data URL, not a link to one, so
// nothing here goes over the network — see avatar.ts for why it's stored that way.
//
// normalizeUser() already substitutes the placeholder for users the server sent
// no avatar for, so the fallback below is for the callers that build a user
// object by hand: ProfilePage previews a pick that may still be empty.
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
