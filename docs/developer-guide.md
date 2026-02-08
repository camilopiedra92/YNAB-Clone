# Developer Guide

This guide provides instructions for setting up the development environment and managing the YNAB Clone application.

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher.
- **npm / yarn**: For dependency management.

### Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Running the Application

To start the development server:
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

## Database Management

The application uses a local SQLite database located at `db/ynab.db`.

### Resetting the Database

If you need a clean start with fresh test data, use the reset workflow:
```bash
/reset-db
```
This script will delete the existing database and re-import the standard YNAB export data for testing.

### Manual Schema Initialization

If you create the `db/ynab.db` file manually, the application will initialize the schema from `db/schema.sql` on the next start.

## Agent Workflows

The project includes specialized workflows for common tasks:

- **`/start`**: Installs dependencies and launches the Next.js dev server.
- **`/cleanup`**: Stops all running application processes.
- **`/reset-db`**: Performs a full database reset and data re-import.

## Directory Structure

- `/app`: Next.js App Router pages and API routes.
- `/components`: Shared React components.
- `/components/budget`: Budget-specific components (rows, inspector, etc.).
- `/hooks`: Custom React hooks for data fetching and state.
- `/lib`: Server-side libraries, primarily `db.ts` for database access.
- `/db`: Database schema and SQLite file.
- `/scripts`: Utility scripts for data migration and debugging.
- `/docs`: Project documentation.

## Testing & Debugging

- **Debugging RTA**: Use `scripts/debug-rta.js` to inspect the calculations for "Ready to Assign".
- **Logs**: API request and database query errors are logged to the console during development.
