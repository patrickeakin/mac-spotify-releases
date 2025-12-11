# NUMU - macOS Spotify Releases Tracker

A macOS desktop application for tracking new releases from your followed Spotify artists.

## Features

- Track new releases from your Spotify followed artists
- Local storage with electron-store for persistence
- Filter releases by time period (today, 7 days, 90 days, 6 months)
- Sort by artist or release date
- Native macOS menu integration
- Offline viewing of cached releases

## Development

### Prerequisites

- Node.js (v16 or higher)
- macOS development environment

### Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start development mode:
```bash
npm run electron:dev
```

This will start the React development server and launch the Electron app.

### Building

To create a packaged app for testing:
```bash
npm run electron:pack
```

To create a distributable DMG:
```bash
npm run electron:dist
```

## Storage

The app uses electron-store for persistent local storage:

- **Spotify access token**: Securely stored for authentication
- **Followed artists**: Cached locally to reduce API calls
- **Release data**: Stored with timestamps for offline viewing
- **User preferences**: Window state and settings

## Architecture

- **React Frontend**: Existing web app UI
- **Electron Main Process**: Window management, menu, storage
- **Storage Service**: Abstraction layer for electron-store/localStorage
- **API Services**: Spotify and MusicBrainz integration

## License

Private use only.