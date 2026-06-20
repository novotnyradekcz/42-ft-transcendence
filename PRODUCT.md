# FT_BBS (Forty-Two Bulletin Board System)

Inspired by the [Bulletin Board Systems](https://en.wikipedia.org/wiki/Bulletin_board_system) of the 1980s, FT_BBS is a social platform allowing users to send messages and play games against each other right in the browser. The user interface is purposefully designed to resemble the classic terminals that the original BBS's used.

Upon opening the website, users are greeted with a simple interface reminescent of a classic UNIX terminal. If they are new, they can create an account using email or via OAuth 2.0 using Gmail, GitHub, or their 42 login. Once they sign in, they have several options of what to do. They can add other users to their friends list, they can visit discussions, send messages to other users or play one of several games with charming ASCII art.

## Main features

- User interface reminiscent of a classic UNIX terminal
- Users can create and customize their user profile
- Users can sign in using OAuth2 and secure their account with 2FA
- Users can message other users
- Users can play games with other users
- Switching between 3 languages

## Required Modules

### Web

- **Major:** Use a framework for both the frontend and backend.
  - Use a frontend framework (React, Vue, Angular, Svelte, etc.).
  - Use a backend framework (Express, NestJS, Django, Flask, Ruby on Rails, etc.).
  - Full-stack frameworks (Next.js, Nuxt.js, SvelteKit) count as both if you use both their frontend and backend capabilities.

- **Major:** Implement real-time features using WebSockets or similar technology.
  - Real-time updates across clients.
  - Handle connection/disconnection gracefully.
  - Efficient message broadcasting.

- **Major:** Allow users to interact with other users. The minimum requirements are:
  - A basic chat system (send/receive messages between users).
  - A profile system (view user information).
  - A friends system (add/remove friends, see friends list).

- **Major:** A public API to interact with the database with a secured API key, rate limiting, documentation, and at least 5 endpoints:
  - `GET /api/{something}`
  - `POST /api/{something}`
  - `PUT /api/{something}`
  - `DELETE /api/{something}`

- **Minor:** Use an ORM for the database.

- **Minor:** A complete notification system for all creation, update, and deletion actions.

### Accessibility and Internationalization

- **Major:** Complete accessibility compliance (WCAG 2.1 AA) with screen reader support, keyboard navigation, and assistive technologies.

- **Minor:** Support for multiple languages (at least 3 languages).
  - Implement i18n (internationalization) system.
  - At least 3 complete language translations.
  - Language switcher in the UI.
  - All user-facing text must be translatable.

### User Management

- **Major:** Standard user management and authentication.
  - Users can update their profile information
  - Users can upload an avatar (with a default avatar if none provided).
  - Users can add other users as friends and see their online status.
  - Users have a profile page displaying their information.

- **Minor:** Game statistics and match history (requires a game module).
  - Track user game statistics (wins, losses, ranking, level, etc.).
  - Display match history (1v1 games, dates, results, opponents).
  - Show achievements and progression.
  - Leaderboard integration.

- **Minor:** Implement remote authentication with OAuth 2.0 (Google, GitHub, 42, etc.).

- **Minor:** Implement a complete 2FA (Two-Factor Authentication) system for the users.

### Gaming and user experience

- **Major:** Implement a complete web-based game where users can play against each other.
  - The game can be real-time multiplayer (e.g., Pong, Chess, Tic-Tac-Toe, Card games, etc.).
  - Players must be able to play live matches.
  - The game must have clear rules and win/loss conditions.
  - The game can be 2D or 3D.

## Optional Modules

### Artificial Intelligence

#### **Major:** Introduce an AI Opponent for games.
- The AI must be challenging and able to win occasionally.
- The AI should simulate human-like behavior (not perfect play).
- If you implement game customization options, the AI must be able to use them.
- You must be able to explain your AI implementation during evaluation.