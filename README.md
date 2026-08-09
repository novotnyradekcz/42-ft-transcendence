*This project has been created as part of the 42 curriculum by nspalevi, rludik, rnovotny, voparkan.*

# Project Name: ft_transcendence

## Description
**ft_transcendence** (FT_BBS - Forty-Two Bulletin Board System) is a full-stack web application inspired by the nostalgic Bulletin Board Systems (BBS) and classic UNIX terminal interfaces of the 1980s. Designed with a retro ASCII terminal user interface, the platform allows users to create accounts, customize profiles, connect with friends, send private direct mail, participate in community discussion boards, and play real-time multiplayer retro games directly in the browser.

The project is architected with a high-performance **Rust (Actix-web)** backend, a **PostgreSQL** database managed via **Diesel ORM**, a **React 19 + TypeScript + Vite** frontend, an **Nginx** reverse proxy, and a WebAssembly-powered Lua game execution sandbox (**Wasmoon**).

## Instructions

### Prerequisites

#### Core System & Containerization
- **Docker Engine** (v20.10+ recommended) & **Docker Compose** (v2 `docker compose` or legacy v1 `docker-compose`) for running the multi-container microservices stack (PostgreSQL 17, Actix-web server, and Nginx frontend).
- **GNU Make** (recommended) for running single-command stack management targets (`make up`, `make down`, `make logs`, `make full`, `make fclean`).

#### Environment Configuration (`.env` Setup)
Before starting the application, ensure the backend environment configuration file (`server/.env`) exists. Initialize it by copying the template file:
```sh
cp server/.env.example server/.env
```

The environment variables configured in `server/.env` are:
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string *(overridden in Docker Compose to target `db:5432`)* |
| `DATABASE_PASSWORD` | PostgreSQL database password |
| `SECRET_HASH` | Secret key used for password hashing and security verification |
| `JWT_HASH` | Secret key used for signing and verifying JWT session tokens |

#### Optional Local Development Tooling
To run local non-containerized development server, tests, or code checks directly on your host system (or when executing `make full`):
- **Node.js** (v22+ or v24+, see `.nvmrc`) & **npm** (v10+): Required for frontend package installation (`npm ci`), development server (`npm run dev`), SPA bundle build (`npm run build`), ESLint (`npm run lint`), and Vitest (`npm test`).
- **Rust Toolchain** (v1.95.0, Edition 2021) & **Cargo**: Required for local backend compilation and syntax verification (`cargo check`).
- **PostgreSQL 17 Client Libraries (`libpq`) & C Build Tools**: Required if compiling the backend natively outside Docker (`pq-sys`, `openssl-sys`).

---

### Installation & Execution

#### 1. Configure Environment
Initialize the environment configuration file:
```sh
cp server/.env.example server/.env
```
Add configuration values to `.env` file.

#### 2. Launch the Application
Run the full stack with a single command from the repository root:
```sh
make up
```
*Alternatively, invoke Docker Compose directly:*
```sh
docker compose up --build -d
```
*(For workstations with legacy Compose v1: `docker-compose up --build -d`)*

#### 3. Access Points & Seeded Accounts
Once containers are running, access the services:
- **Web Interface (Frontend):** [http://localhost:3000](http://localhost:3000)
- **REST API Backend:** [http://localhost:8080](http://localhost:8080) (or via Nginx proxy at `http://localhost:3000/api`)

Default seeded test accounts created on backend startup (if they do not already exist):

| Username | Password | Role |
|---|---|---|
| `test` | `test` | Standard User |
| `admin` | `admin` | Administrator |
| `guest` | `guest` | Guest User |

#### 4. Stack Management Commands
Below are the GNU Make shortcut commands available for managing the project stack:

| Command | Action |
|---|---|
| `make up` | Build Docker images and start all containers in detached mode |
| `make logs` | Stream live combined logs from all containers (`docker compose logs -f`) |
| `make ps` | List running container status and port mappings (`docker compose ps`) |
| `make build` | Rebuild Docker container images (`docker compose build`) |
| `make down` | Stop and remove running containers (`docker compose down`) |
| `make full` | Install local dependencies (`npm ci`), run backend checks (`cargo check`), build frontend assets (`npm run build`), run frontend linter (`npm run lint`), and build Docker images |
| `make fclean` | Stop containers, remove volumes (`--volumes`), delete local images (`--rmi local`), remove orphaned containers, and purge local build artifacts (`frontend/node_modules`, `frontend/dist`, `server/target`) |


## Resources

### Technology Documentation & References
- **Rust & Actix-web**: [Actix-web Documentation](https://actix.rs/docs/) & [The Rust Programming Language Book](https://doc.rust-lang.org/book/)
- **Diesel ORM**: [Diesel Getting Started Guide](https://diesel.rs/guides/)
- **PostgreSQL**: [PostgreSQL 17 Official Manual](https://www.postgresql.org/docs/17/index.html)
- **React & TypeScript**: [React 19 Documentation](https://react.dev/) & [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- **Vite Tooling**: [Vite Guide](https://vite.dev/guide/)
- **Wasmoon (Lua WASM)**: [Wasmoon GitHub Repository](https://github.com/ceifa/wasmoon)
- **Docker & Compose**: [Docker Compose Documentation](https://docs.docker.com/compose/)
- **Nginx**: [Nginx Beginner's Guide](https://nginx.org/en/docs/beginners_guide.html)

### AI Usage
Artificial Intelligence tools (LLMs and AI coding assistants) were used throughout the development process for several key tasks:
- **Boilerplate Generation:** Generating initial boilerplate code for React components, Actix-web route handler signatures, and Diesel migration files.
- **Documentation & README Drafting:** Structuring and drafting project documentation, architectural overviews, database schema definitions (Mermaid ER diagrams), and section summaries.
- **Learning New Technologies:** Accelerated learning curves for unfamiliar tools, such as embedding WebAssembly Lua sandboxes (`wasmoon`), configuring `actix-security` authentication pipelines, and writing compile-time validated Diesel ORM queries.
- **Troubleshooting & Debugging:** Diagnosing compiler errors, analyzing stack traces, debugging WebSocket lobby state synchronization, and optimizing multi-stage Docker container builds.

## Team Information
| Name      | Role(s)              | Responsibilities                |
|-----------|----------------------|---------------------------------|
| nspalevi  | PM, Developer        | meetings, deadlines             |
| rludvik   | Developer            | development, testing            |
| rnovotny  | PO, Developer        | PRD, backlog, documentation     |
| voparkan  | Tech Lead, Developer | architecture, technical details |

## Project Management
### Organization
- Initial product vision was created by the PO, with specific tech details added by the Tech Lead. The PM created tasks from this description and the team members chose tasks to work on.
- Weekly to biweekly standups were held to discuss progress and any issues encountered. The date of the next meeting was decided at the end and posted to Slack by the PM.

### Tools
- A Github repository was used to store the code and a GitHub project was used to organize work.
- A Kanban board in Github was used to track issues. Issues were moved from the *Backlog* column to the *Ready* column, and when someone started working on an issue, they moved it to the *In progress* column.
- After completing work on an issue, a PR was created in GitHub and the issue was moved to the *In review* column. Other team members provided feedback and comments and when they approved the PR, the issue was moved to the *Done* column and marked completed.


### Communication
- Slack was used for messaging, planning and organizing meetings.
- After some issues with Slack's voice chat, Discord was used for online meetings.

## Technical Stack
### Frontend
- **React 19** (`react`, `react-dom`) - Client-side component UI framework.
- **TypeScript 6** - Strict type safety and developer tooling.
- **Vite 8** - Next-generation frontend build tool and development server with `@vitejs/plugin-react`.
- **React Router DOM 7** (`react-router-dom`) - Declarative Single-Page Application (SPA) routing.
- **Wasmoon** (`wasmoon` 1.16) - WebAssembly-compiled Lua 5.4 engine for client-side game logic execution.
- **Vanilla CSS** - Retro UNIX BBS / ASCII terminal custom design system (`index.css`).
- **Vitest & JSDOM** - Frontend unit and integration testing environment.
- **ESLint 10** - Code quality enforcement and static analysis for React and TypeScript.

### Backend
- **Rust (Edition 2021 / 1.95.0)** - Memory-safe, high-performance system programming language.
- **Actix-web 4** - Asynchronous web framework powering high-concurrency REST API endpoints.
- **Actix-ws** (`actix-ws` 0.3) - Low-latency WebSocket handler for real-time multiplayer lobbies and games.
- **Actix-security & Actix-session** - Authentication framework supporting Argon2 password hashing (`Argon2PasswordEncoder`), HTTP Basic, JWT tokens, and cookie session management.
- **Serde & Serde JSON** - High-performance data serialization and deserialization.
- **Dotenvy & Env Logger** - Environment variable management and structured log logging.

### Database
- **PostgreSQL 17** (`postgres:17.10-trixie`) - Relational database management system running in a dedicated Docker container with persistent volume storage.
- **Diesel 2.2** (`diesel`, `diesel_migrations`) - Type-safe ORM and query builder for Rust with automated schema migrations.
- **Justification**: PostgreSQL delivers strong ACID compliance, robust relational data integrity (critical for user profiles, posts, discussions, mail, and match records), and high concurrent query performance. Diesel guarantees compile-time validation of all SQL queries against the schema, preventing runtime query errors and SQL injection vulnerabilities.

### Other Technologies
- **Docker & Docker Compose v2** - Containerization platform managing multi-stage container builds for `db`, `server`, and `frontend` services.
- **Nginx 1.29** (`nginx:1.29-alpine`) - Reverse proxy server routing static SPA assets, `/api/` HTTP requests, and WebSocket connections.
- **GNU Make** - Development automation tool (`Makefile`) for single-command stack management (`make up`, `make down`, `make full`, `make fclean`, `make logs`).

### Technical Choices
- **Rust + Actix-web**: Chosen for zero-cost abstractions, memory safety without garbage collection overhead, and high-performance async execution needed for real-time game interactions.
- **Diesel ORM**: Ensures compile-time checking of SQL queries against the PostgreSQL schema, catching structural mismatches before runtime.
- **React 19 + TypeScript + Vite**: Provides strict type safety, fast HMR during development, and small production bundle sizes.
- **Wasmoon (Lua WebAssembly Engine)**: Enables client-side execution of Lua scripts for game logic securely inside the browser sandbox.
- **Nginx Reverse Proxy**: Eliminates CORS complications by exposing unified host ports while handling static asset delivery and WebSocket upgrade handshakes.

## Database Schema

### Entity-Relationship Diagram

```mermaid
erDiagram
    ftt_users ||--o{ ftt_posts : "authors"
    ftt_users ||--o{ ftt_games : "creates"
    ftt_users ||--o{ ftt_mail : "sends (sender)"
    ftt_users ||--o{ ftt_mail : "receives (recipient)"
    ftt_discussions ||--o{ ftt_posts : "contains"

    ftt_users {
        SERIAL id PK
        TEXT name
        TEXT email
        TEXT password
        TEXT bio
        TEXT avatar_url
        TEXT friends
    }

    ftt_discussions {
        SERIAL id PK
        INTEGER n_posts
        TEXT name
        TEXT info
        TEXT image
    }

    ftt_posts {
        SERIAL id PK
        INTEGER author FK
        INTEGER discussion_id FK
        TEXT name
        TEXT perex
        TEXT body
        TEXT images
    }

    ftt_mail {
        SERIAL id PK
        INTEGER sender FK
        INTEGER recipient FK
        TEXT title
        TEXT body
        TEXT images
    }

    ftt_games {
        SERIAL id PK
        INTEGER author FK
        TEXT name
        TEXT body
    }
```

### Table Definitions & Relationships

#### 1. `ftt_users`
Stores registered platform users, credentials, profile metadata, and social connections.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unique user identifier |
| `name` | `TEXT` | `NOT NULL` | Username |
| `email` | `TEXT` | `NOT NULL` | User email address |
| `password` | `TEXT` | `NOT NULL` | Password hash |
| `bio` | `TEXT` | `NOT NULL`, `DEFAULT ''` | User bio description |
| `avatar_url` | `TEXT` | `NOT NULL`, `DEFAULT ''` | URL to user's avatar image |
| `friends` | `TEXT` | `NOT NULL`, `DEFAULT '[]'` | JSON-encoded array of friend user IDs |

#### 2. `ftt_discussions`
Represents discussion boards/topics in the terminal forum.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unique discussion identifier |
| `n_posts` | `INTEGER` | `NOT NULL`, `DEFAULT 0` | Total count of posts in this topic |
| `name` | `TEXT` | `NOT NULL` | Topic name |
| `info` | `TEXT` | `NOT NULL` | Topic description / overview |
| `image` | `TEXT` | `NOT NULL` | Topic header image path |

#### 3. `ftt_posts`
Contains posts authored by users within discussion boards.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unique post identifier |
| `author` | `INTEGER` | `NOT NULL`, `REFERENCES ftt_users(id)` | User ID of the post author |
| `discussion_id` | `INTEGER` | `NULLABLE`, `REFERENCES ftt_discussions(id)` | ID of the target discussion board |
| `name` | `TEXT` | `NOT NULL` | Post title/headline |
| `perex` | `TEXT` | `NOT NULL` | Brief summary / excerpt |
| `body` | `TEXT` | `NOT NULL` | Post content |
| `images` | `TEXT` | `NOT NULL` | Image links attached to post |

#### 4. `ftt_mail`
Handles private messaging between platform users.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unique mail message identifier |
| `sender` | `INTEGER` | `NOT NULL`, `REFERENCES ftt_users(id)` | User ID of sender |
| `recipient` | `INTEGER` | `NOT NULL`, `REFERENCES ftt_users(id)` | User ID of recipient |
| `title` | `TEXT` | `NOT NULL` | Subject line |
| `body` | `TEXT` | `NOT NULL` | Message body content |
| `images` | `TEXT` | `NOT NULL` | Attached image URLs/metadata |

#### 5. `ftt_games`
Stores custom games created or hosted on the platform.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unique game identifier |
| `author` | `INTEGER` | `NOT NULL`, `REFERENCES ftt_users(id)` | Creator/author user ID |
| `name` | `TEXT` | `NOT NULL` | Game title |
| `body` | `TEXT` | `NOT NULL` | Game metadata or code definition |

## Features List
| Feature | Description | Team Member(s) |
|---|---|---|
| Retro UNIX Terminal UI | Responsive ASCII BBS-inspired command-line interface with keyboard shortcuts, command aliases, and terminal navigation | nspalevi |
| User Authentication & Security | Account registration, login, logout, password hashing with Argon2, JWT token support, and cookie-based session management | voparkan |
| User Profiles & Customization | Personal profile pages displaying username, bio, custom avatar URL, and user details | nspalevi |
| Friends System & Social Status | Add/remove friends, view friend lists, inspect user details, and manage social connections | nspalevi |
| Direct Messaging (Mail) | Private non-live mail system for sending, receiving, and reading messages between platform users | nspalevi |
| Forum Discussions & Posts | Public discussion boards for creating topics, reading threads, and posting community replies | nspalevi |
| Real-time Multiplayer Gaming | Low-latency multiplayer game matchmaking and live gameplay powered by WebSockets | rnovotny |
| Client-side WebAssembly Lua Engine | Wasmoon-powered Lua 5.4 execution sandbox for running client-side games securely in the browser | rnovotny |
| Multi-language Support (i18n) | Internationalization system allowing seamless switching between interface languages (`lang` command) | nspalevi |
| Secured REST API | High-performance Actix-web endpoints for users, discussions, posts, mail, and games | voparkan |
| Dockerized Microservices Stack | Containerized multi-service stack (PostgreSQL 17, Actix-web, Nginx) managed via Docker Compose and GNU Make | voparkan |

## Modules
| Module Name | Type (Major/Minor) | Points | Justification & Implementation | Team Member(s) |
|---|---|---|---|---|
| Framework for both frontend and backend | Major | 2 | **Why:** High performance and SPA modularity.<br>**How:** Built using React 19 + TypeScript 6 + Vite 8 on frontend and Actix-web 4 (Rust) for async API routing on backend. | nspalevi, voparkan |
| Real-time features using WebSockets | Major | 2 | **Why:** Low-latency bi-directional game communication without HTTP polling.<br>**How:** Implemented using `actix-ws` on endpoint `/games/play` and client WebSocket handlers for live game lobby sync. | rnovotny |
| User interaction - chat, profile & friends system | Major | 2 | **Why:** Core social features for terminal user engagement.<br>**How:** Interactive profile page, friend list management (`addfriend`/`removefriend`), direct mail messaging, and forum boards built into terminal UI. | nspalevi |
| Public API to interact with the database | Major | 2 | **Why:** Secure REST access to application data.<br>**How:** Exposed Actix-web JSON endpoints (`/users`, `/discussions`, `/mail`, `/games`) with session authentication and structured HTTP responses. | voparkan |
| ORM for the database | Minor | 1 | **Why:** Compile-time database query safety and schema management.<br>**How:** Used Diesel 2.2 ORM with PostgreSQL migrations (`schema.rs`) for strongly typed Rust database queries. | voparkan |
| Support for multiple languages | Minor | 1 | **Why:** Accessibility for multi-lingual users.<br>**How:** Custom client-side i18n translation system supporting dynamic switching between 3 languages (`en`, `cs`, `es`) via `lang` command. | nspalevi |
| Standard user management and authentication | Major | 2 | **Why:** Secure account protection and session persistence.<br>**How:** Implemented `actix-security` (Argon2 password hashing, JWT tokens, cookie sessions) integrated with user profile workflows. | nspalevi, voparkan |
| Web-based game where users can play against each other | Major | 2 | **Why:** Core gaming experience requirement.<br>**How:** Interactive retro terminal web game (`GamePlayPage.tsx`) running real-time game loop logic, paddle physics, and match state tracking. | rnovotny |
| Two players on separate computers | Major | 2 | **Why:** Remote competitive multiplayer support.<br>**How:** Multi-client WebSocket lobbies (`Lobby`, `play_game_ws`) hosting remote 1v1 matches across independent client connections. | rnovotny |
| Game customization options | Minor | 1 | **Why:** Flexible, sandboxed game scripting.<br>**How:** Integrated Wasmoon (Lua 5.4 in WebAssembly) for client-side execution of custom game logic and rules. | rnovotny |


## Individual Contributions
| Name | Contributions (features/modules/components) | Challenges & Solutions |
|---|---|---|
| nspalevi | Frontend architecture, retro UNIX Terminal UI, User Profile system, Friends system, Direct Messaging (Mail), Forum Discussions & Posts, and Multi-language support (i18n) | **Challenge:** Creating an interactive command-line style terminal interface in React while ensuring responsive web layout and full keyboard/command access.<br>**Solution:** Developed a custom command parser hook and modular terminal section components styled with responsive monospace Vanilla CSS. |
| rnovotny | Real-time WebSockets multiplayer gaming engine, remote 2-player matchmaking, client-side WebAssembly Lua integration (Wasmoon), and game customization engine | **Challenge:** Syncing real-time multiplayer game state across remote clients with minimal latency and safe client-side script execution.<br>**Solution:** Implemented `actix-ws` backend game lobbies paired with Wasmoon (Lua 5.4 in WebAssembly) for sandboxed browser-side game loop execution. |
| voparkan | System architecture, Actix-web backend REST API, database design with PostgreSQL 17 & Diesel ORM, user authentication (Argon2, JWT, Sessions), and Docker Compose orchestration | **Challenge:** Ensuring compile-time schema type safety, robust session authentication, and seamless container networking.<br>**Solution:** Configured Diesel ORM compile-time SQL verification, Actix-security authentication pipelines, and an Nginx reverse proxy setup. |

## Usage

### Launching the Application
Start the full stack with a single command from the project root:
```sh
make up
```
- **Web Interface (Frontend):** `http://localhost:3000`
- **REST API Backend:** `http://localhost:8080`

Default seeded accounts created on startup:
```text
test / test
admin / admin
guest / guest
```

### Interactive Terminal Commands
The application features a terminal-style command interface. Below are the primary commands available:

| Command | Aliases | Usage | Description |
|---|---|---|---|
| `help` | `?`, `h` | `help` | Show available commands for the current screen |
| `menu` | `home`, `me` | `menu` | Return to the main board menu |
| `users` | `u` | `users` | Open the registered user directory |
| `login` | `logi` | `login` | Start command-line authentication flow |
| `register` | `r`, `reg` | `register` | Start account registration flow |
| `profile` | `p` | `profile` | Display current user profile and status |
| `friends` | `f` | `friends` | Open friend list |
| `addfriend` | `friend`, `af` | `addfriend <id>` | Add a user to your friend list |
| `removefriend` | `unfriend`, `rf` | `removefriend <id>` | Remove a user from your friend list |
| `discussions` | `d` | `discussions` | Access public discussion boards |
| `mail` | `m` | `mail` | Open private mailbox |
| `games` | `g` | `games` | Browse available games |
| `enter` | `open`, `e` | `enter <number>` | Open item details from the active list |
| `write` | `w` | `write` | Start writing a new post or mail message |
| `lang` | `language` | `lang en` | Switch interface language (`en`, `cs`, `es`) |
| `back` | `cancel`, `b` | `back` | Navigate back one level (or press `Esc` / `Ctrl+C`) |

### Key API & WebSocket Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/` | Server healthcheck & index |
| `POST` | `/api/users/login` | User login and session issuance |
| `POST` | `/api/users/create` | User account registration |
| `GET` | `/api/users` | List registered platform users |
| `GET` | `/api/discussions` | List public discussion boards |
| `POST` | `/api/discussions/post` | Submit a post to a discussion thread |
| `GET` | `/api/mail` | Fetch private mailbox messages |
| `POST` | `/api/mail/create` | Send a private mail message |
| `GET` | `/api/games` | List available games |
| `WS` | `/api/games/play` | Real-time WebSocket connection for game lobbies and gameplay |

---

## Known Limitations

- **In-Memory Game Lobby State:** Multiplayer game lobbies and active player pairing states are managed in-memory using thread-safe Mutexes within the backend application state. Horizontal scaling across multiple server instances would require an external pub/sub layer (e.g., Redis).
- **WebAssembly Engine Dependency:** Client-side Lua game execution relies on WebAssembly (`wasmoon` and `glue.wasm`). Browsers with WebAssembly disabled or blocked will be unable to run client-side game scripts.
- **Pre-seeded Development Accounts:** Default accounts (`test`, `admin`, `guest`) are initialized automatically at server boot for evaluation and testing.
- **Static Translation Sets:** Multi-language internationalization supports pre-defined dictionary translation sets (`en`, `cs`, `es`). User-generated content (posts, messages, bios) remains in its original submitted language.

## License
- (Optional) License information

## Credits
- (Optional) Acknowledgments, third-party credits, etc.
