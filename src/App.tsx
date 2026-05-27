import { type ChangeEvent, type FormEvent, useState } from "react";

type Page = "home" | "login" | "register" | "profile" | "users";

type UserProfile = {
  username: string;
  email: string;
};

type RegisteredUser = UserProfile & {
  password: string;
};

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [loginError, setLoginError] = useState("");

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const foundUser = registeredUsers.find(
      (registeredUser) =>
        registeredUser.username === loginUsername &&
        registeredUser.password === loginPassword,
    );

    if (!foundUser) {
      setLoginError("Username or password is incorrect.");
      return;
    }

    // Later: replace this mock login with a call to the Rust backend.
    setUser({
      username: foundUser.username,
      email: foundUser.email,
    });
    setLoginError("");
    setPage("home");
  }

  function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Later: replace this mock register with a call to the Rust backend.
    const newUser = {
      username: registerUsername,
      email: registerEmail,
      password: registerPassword,
    };

    setRegisteredUsers([...registeredUsers, newUser]);
    setUser({
      username: newUser.username,
      email: newUser.email,
    });
    setPage("home");
  }

  function handleLogout() {
    setUser(null);
    setPage("home");
  }

  function handleDeleteAccount() {
    // Later: replace this mock delete with a call to the Rust backend.
    setUser(null);
    setLoginUsername("");
    setLoginPassword("");
    setRegisterUsername("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisteredUsers(
      registeredUsers.filter((registeredUser) => registeredUser.username !== user?.username),
    );
    setPage("home");
  }

  return (
    <main className="min-h-screen bg-neutral-600 text-black">
      <nav className="flex items-center justify-between border-b border-black px-6 py-4">
        <button
          type="button"
          onClick={() => setPage("home")}
          className="border border-black bg-neutral-500 px-4 py-2 font-bold text-black hover:bg-black hover:text-white"
        >
          ft_transcendance
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage("users")}
            className="border border-black bg-neutral-500 px-4 py-2 text-black hover:bg-black hover:text-white"
          >
            List users
          </button>

          {user ? (
            <>
              <button
                type="button"
                onClick={() => setPage("profile")}
                className="border border-black bg-neutral-500 px-4 py-2 text-black hover:bg-black hover:text-white"
              >
                Profile
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="border border-black bg-neutral-500 px-4 py-2 text-black hover:bg-black hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPage("login")}
                className="border border-black bg-neutral-500 px-4 py-2 text-black hover:bg-black hover:text-white"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setPage("register")}
                className="border border-black bg-neutral-500 px-4 py-2 text-black hover:bg-black hover:text-white"
              >
                Register
              </button>
            </>
          )}
        </div>
      </nav>

      {page === "home" && (
        <section className="mx-auto max-w-3xl px-6 py-12">
          <h1 className="text-4xl font-bold">ft_transcendance</h1>
          <p className="mt-4 text-lg">
            Hello world
          </p>

          {/* {user ? (
            <p className="mt-6 border border-black p-4">
              You are logged in as <strong>{user.username}</strong>.
            </p>
          ) : (
            <div className="mt-6 flex gap-2">
              <button
                type="button"
              onClick={() => setPage("login")}
              className="border border-black bg-neutral-500 px-4 py-2 text-black hover:bg-black hover:text-white"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setPage("register")}
                className="border border-black bg-neutral-500 px-4 py-2 text-black hover:bg-black hover:text-white"
              >
                Register
              </button>
            </div>
          )} */}
        </section>
      )}

      {page === "login" && (
        <section className="mx-auto max-w-md px-6 py-12">
          <h1 className="text-3xl font-bold">Login</h1>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <TextInput
              label="Username"
              value={loginUsername}
              onChange={(event) => setLoginUsername(event.target.value)}
            />
            <TextInput
              label="Password"
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
            />
            {loginError && (
              <p className="border border-black p-3">
                {loginError}
              </p>
            )}
            <button
              type="submit"
              className="border border-black bg-neutral-500 px-4 py-2 text-black hover:bg-black hover:text-white"
            >
              Login
            </button>
          </form>
        </section>
      )}

      {page === "register" && (
        <section className="mx-auto max-w-md px-6 py-12">
          <h1 className="text-3xl font-bold">Register</h1>
          <form onSubmit={handleRegister} className="mt-6 space-y-4">
            <TextInput
              label="Username"
              value={registerUsername}
              onChange={(event) => setRegisterUsername(event.target.value)}
            />
            <TextInput
              label="Email"
              type="email"
              value={registerEmail}
              onChange={(event) => setRegisterEmail(event.target.value)}
            />
            <TextInput
              label="Password"
              type="password"
              value={registerPassword}
              onChange={(event) => setRegisterPassword(event.target.value)}
            />
            <button
              type="submit"
              className="border border-black bg-neutral-500 px-4 py-2 text-black hover:bg-black hover:text-white"
            >
              Register
            </button>
          </form>
        </section>
      )}

      {page === "profile" && user && (
        <section className="mx-auto max-w-md px-6 py-12">
          <h1 className="text-3xl font-bold">Profile</h1>
          <div className="mt-6 border border-black p-4">
            <p>
              <strong>Username:</strong> {user.username}
            </p>
            <p className="mt-2">
              <strong>Email:</strong> {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDeleteAccount}
            className="mt-4 border border-black bg-neutral-500 px-4 py-2 text-black hover:bg-black hover:text-white"
          >
            Delete account
          </button>
        </section>
      )}

      {page === "users" && (
        <section className="mx-auto max-w-md px-6 py-12">
          <h1 className="text-3xl font-bold">Users</h1>

          {registeredUsers.length === 0 ? (
            <p className="mt-6 border border-black p-4">
              No users registered yet.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {registeredUsers.map((registeredUser) => (
                <div
                  key={registeredUser.username}
                  className="border border-black p-4"
                >
                  <p>
                    <strong>Username:</strong> {registeredUser.username}
                  </p>
                  <p className="mt-2">
                    <strong>Email:</strong> {registeredUser.email}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function TextInput({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-bold">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        required
        className="w-full border border-black px-3 py-2"
      />
    </label>
  );
}
