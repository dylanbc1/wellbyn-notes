# How to Run Notes Frontend

## Prerequisites

1. Node.js 18 or higher (download from https://nodejs.org/)
2. npm (included with Node.js)
3. Notes Backend running at http://localhost:8000

## Setup Instructions

### 1. Navigate to Directory

```bash
cd notes-frontend
```

### 2. Install Dependencies

```bash
npm install
```

This may take a few minutes on the first run.

### 3. Configure Environment (Optional)

If your backend is running at a different URL:

```bash
# Create .env file
echo "VITE_API_URL=http://your-backend-url:port" > .env
```

The default backend URL is `http://localhost:8000`.

## Running in Development Mode

```bash
npm run dev
```

The application will be available at http://localhost:3000

## Building for Production

### 1. Build the Application

```bash
npm run build
```

This creates a `dist/` directory with optimized files.

### 2. Preview the Build

```bash
npm run preview
```

### 3. Serve in Production

```bash
npm run start
```

Or use any static file server:

```bash
# Using serve
npx serve -s dist -p 3000

# Using nginx
# Copy dist/ contents to /var/www/html/
```

## Testing the Application

### 1. Check Backend Connection

When you open http://localhost:3000, you should see:
- Green "Backend connected" badge in the header
- If it's red, verify the backend is running

### 2. Record Audio

1. Click the microphone button
2. Allow microphone access (if prompted by browser)
3. Speak clearly
4. Click the "Stop" button
5. Click "Transcribe Audio"
6. Wait for the transcription (typically 10-30 seconds)

### 3. Upload Audio File

1. Click "Upload audio file"
2. Select an MP3, WAV, M4A, or other supported format
3. Click "Transcribe Audio"
4. Wait for the result

## Troubleshooting

### Backend Appears Disconnected

```bash
# Verify the backend is running
curl http://localhost:8000/api/health

# If it doesn't respond, start the backend
cd ../notes-backend
python main.py
```

### Error: "Cannot find module"

```bash
# Clean node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Audio Recording Issues

- **Chrome/Edge**: Works well
- **Firefox**: Check microphone permissions
- **Safari**: May require HTTPS in production
- **Solution**: Use the file upload option if recording doesn't work

### Port 3000 Already in Use

```bash
# Option 1: Kill the process
# On Mac/Linux:
lsof -ti:3000 | xargs kill -9

# Option 2: Use a different port
npm run dev -- --port 3001
```

### CORS Error When Calling Backend

Verify the backend has CORS properly configured in `config.py`:
```python
ALLOWED_ORIGINS: list = ["*"]  # or ["http://localhost:3000"]
```

### Build Fails with TypeScript Errors

```bash
# Temporarily ignore type errors
npm run build -- --no-type-check

# Or fix the errors
npm run lint
```

## Available Commands

```bash
# Development
npm run dev           # Start development server

# Build
npm run build         # Build for production
npm run preview       # Preview production build

# Code Quality
npm run lint          # Run linter
npm run type-check    # Check TypeScript types

# Clean
rm -rf node_modules dist
npm install
```

## Customization

### Change Development Port

Edit `vite.config.ts`:
```typescript
server: {
  port: 3001,  // Change here
  // ...
}
```

### Change Backend URL

Option 1 - Environment variable:
```bash
echo "VITE_API_URL=http://my-backend.com" > .env
```

Option 2 - Edit `src/services/api.ts`:
```typescript
const API_BASE_URL = 'http://my-backend.com';
```

## Features

Once running, you can:
- Record or upload audio files
- View transcriptions
- Browse history
- Delete old transcriptions

The application uses the **openai/whisper-base** model for transcription, which is a lightweight model offering fast transcription for multiple languages including Spanish.

## Resources

- React Documentation: https://react.dev/
- Vite Documentation: https://vitejs.dev/
- Tailwind CSS: https://tailwindcss.com/
