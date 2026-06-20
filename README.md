*This project has been created as part of the 42 curriculum by rnovotny, spalevi, voparkan.*

# Project Name: ft_transcendence

## Description
A brief overview of the project, its main goal, and key features.

## Instructions
### Prerequisites
- List all required software, tools, and versions (e.g., Node.js, Docker, etc.)
- Configuration steps (e.g., .env setup)

### Installation & Execution

Run everything with one command from this folder:
```sh
make up
```
Or run Compose directly in detached mode:
```sh
docker compose up --build -d
```
If the installed CLI on your workstation is the legacy Compose v1 binary, the
equivalent command is:
```sh
docker-compose up --build -d
```
For logs, run:
```sh
make logs
```
To stop everything:
```sh
make down
```
To install local dependencies, run checks, and build the Docker images:
```sh
make full
```
To stop the stack and remove generated local artifacts plus this Compose
project's local images and database volume:
```sh
make fclean
```
Website:
```text
http://localhost:3000
```
backend:
```text
http://localhost:8080
```

Seeded users are created on backend startup if they do not already exist:

```text
test / test
admin / admin
guest / guest
```

## Resources
- List of classic references (documentation, articles, tutorials, etc.)
- **AI Usage:** Describe how AI was used, for which tasks, and which parts of the project.

## Team Information
| Name      | Role(s)              | Responsibilities                |
|-----------|----------------------|---------------------------------|
| rnovotny  | PO, Developer        | PRD, backlog                    |
| spalevi   | PM, Developer        | meetings, deadlines             |
| voparkan  | Tech Lead, Developer | architecture, technical details |
| ...       | ...                  | ...                             |

## Project Management
- **Organization:** How the team distributed tasks, held meetings, etc.
- **Tools:** (e.g., GitHub Issues, Trello)
- **Communication:** (e.g., Discord, Slack)

## Technical Stack
### Frontend
- Technologies and frameworks used

### Backend
- Technologies and frameworks used

### Database
- System used and justification

### Other Technologies
- Any other significant libraries or tools

### Technical Choices
- Justification for major decisions

## Database Schema
- Visual representation or description of the database structure
- List of tables/collections, relationships, key fields, and data types

## Features List
| Feature                | Description                | Team Member(s) |
|------------------------|----------------------------|----------------|
| Example Feature        | Brief description          | <login1>       |
| ...                    | ...                        | ...            |

## Modules
| Module Name           | Type (Major/Minor) | Points | Justification & Implementation | Team Member(s) |
|-----------------------|-------------------|--------|-------------------------------|----------------|
| Example Module        | Major             | 2      | Why & how it was used         | <login2>       |
| ...                   | ...               | ...    | ...                           | ...            |

## Individual Contributions
| Name      | Contributions (features/modules/components) | Challenges & Solutions |
|-----------|--------------------------------------------|-----------------------|
| <login1>  | List specific contributions                | Brief description     |
| <login2>  | ...                                        | ...                  |
| ...       | ...                                        | ...                  |

## Usage
- (Optional) Usage examples, API endpoints, screenshots, etc.

## Known Limitations
- List any known issues or limitations

## License
- (Optional) License information

## Credits
- (Optional) Acknowledgments, third-party credits, etc.
