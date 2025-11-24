# SPA Digital Kiosk

A touchscreen kiosk application for spa reception areas with a web-based admin panel.

## Features

- **Digital Menu Mode** - Display massage services with photos/videos
- **Slideshow Mode** - Rotating promotional content
- **Survey Mode** - Customer feedback collection
- **Google QR Mode** - Review collection via QR codes
- **Admin Panel** - Manage content, view analytics, configure settings

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Run development servers
npm run dev

# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

### Production Deployment

**Windows:**
```bash
cd deployment
windows-deploy.bat
```

**Raspberry Pi:**
```bash
cd deployment
chmod +x *.sh
./deploy-pi.sh
```

See [deployment/README.md](deployment/README.md) for detailed instructions.

## Project Structure

```
spa-digital-kiosk/
├── frontend/          # React app (Kiosk + Admin)
├── backend/           # Node.js API server
├── deployment/        # Deployment scripts and guides
├── data/              # SQLite database and uploads
└── logs/              # Application logs
```

## Technology Stack

**Frontend:** React 18, TypeScript, Vite, TanStack Query, Zustand, Tailwind CSS

**Backend:** Node.js, Express, TypeScript, SQLite, Google Sheets API

## Default Credentials

- Username: `admin`
- Password: `admin123`

**⚠️ Change these immediately after first login!**

## Documentation

- [Windows Deployment](deployment/WINDOWS.md)
- [Raspberry Pi Deployment](deployment/RASPBERRY_PI.md)
- [Testing Guide](TESTING_GUIDE.md)
- [Steering Rules](.kiro/steering/README.md)

## Support

For issues and troubleshooting, see the platform-specific deployment guides.
