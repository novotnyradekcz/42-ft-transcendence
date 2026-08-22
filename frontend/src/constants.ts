// Fixed values used in more than one file. The two storage keys matter most:
// api.ts writes them and SessionContext reads them, so they can't be inlined
// in either without the risk of the two drifting apart.

// bundled placeholder for users with no avatar
export const PH_USER_IMAGE = "/images/profile.png";

// sessionStorage key for the stored credentials
export const CREDENTIALS_KEY = "ft_transcendence.credentials";

// sessionStorage key for the stored SessionUser
export const SESSION_USER_KEY = "ft_transcendence.sessionUser";
