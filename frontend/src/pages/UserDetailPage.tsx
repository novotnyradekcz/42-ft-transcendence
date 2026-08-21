// Route wrapper for /users/show/:id. The screen itself is <UserDetail />, which
// is a component rather than a page because the profile screen renders it too.

import UserDetail from "../components/UserDetail";

export default function UserDetailPage() {
  return <UserDetail />;
}
