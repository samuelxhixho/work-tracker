# WorkTracker

WorkTracker is a local-first Windows desktop productivity application for tracking daily work, managing quests, reviewing weekly progress, and keeping a searchable history.

The application is designed to work completely locally. There are no accounts, no cloud backend, and no synchronization between devices.

## Features

- Create, edit, complete, and delete quests
- Organize quests by category, status, and work date
- Dashboard with weekly productivity statistics
- Context-aware dashboard messages
- Weekly Log with generated Markdown reports
- Searchable and filterable work history
- Local application settings
- Persistent local data
- Dark rainy-night inspired interface
- Windows desktop installer

## Technology

### Frontend

- Angular 22
- TypeScript
- SCSS
- Angular Signals
- Reactive Forms

### Backend

- Spring Boot
- Java 25
- Spring Data JPA
- H2
- Flyway
- Maven

### Desktop

- Electron
- electron-builder
- NSIS
- Custom Java runtime generated with `jlink`

## Architecture

WorkTracker runs entirely on the user's computer.

```text
Electron
   |
   v
Spring Boot
   |
   +---- Angular frontend
   |
   +---- REST API
   |
   +---- H2 database
```

Electron starts the bundled Spring Boot application on a local loopback port.

The Angular frontend communicates with the backend through same-origin `/api` routes.

Application data is stored locally under:

```text
%APPDATA%\WorkTracker
```

The application does not require Java to be installed on the user's computer because a minimized Java runtime is bundled with the Windows release.

## Development

### Requirements

- Node.js 22
- npm
- JDK 25

### Frontend

```powershell
cd frontend
npm ci
npm start
```

The Angular development server uses `proxy.conf.json` to forward `/api` requests to the Spring Boot backend.

### Backend

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

## Build a Windows Release

A complete release can be generated from the project root:

```powershell
.\scripts\build-release.ps1
```

The script:

1. Builds the Angular frontend
2. Copies the frontend build into Spring Boot
3. Builds and tests the Spring Boot application
4. Generates a minimized Java 25 runtime
5. Builds the Electron Windows installer

The resulting installer is written to:

```text
desktop\release\WorkTracker-Setup-1.0.0.exe
```

If JDK 25 cannot be detected automatically:

```powershell
.\scripts\build-release.ps1 -JavaHome "C:\path\to\jdk-25"
```

## Local Data

WorkTracker stores its database and logs under:

```text
%APPDATA%\WorkTracker
├── data
└── logs
```

Uninstalling the application should not be treated as a backup strategy. Back up this directory if the stored work history is important.

## Privacy

WorkTracker is local-first.

- No WorkTracker account is required
- No cloud database is used
- No application data synchronization is performed
- Work data remains on the local device

## Version

Current release: **1.0.0**

## Author

Samuel Xhixho