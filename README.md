# AirLabsTodo

React Native Expo Go to-do list app for the AirLabs developer exercise.

## Features

- Add tasks with title, optional description, and optional due date
- Mark tasks complete or incomplete
- Delete tasks
- View all tasks with completed and incomplete visual distinction
- Persist tasks locally with AsyncStorage
- React Navigation with Task List and Add Task screens
- Voice input FAB with microphone recording, Gemini audio transcription, and intelligent task extraction
- Search, due-date sorting, light/dark theme toggle

## Run

```bash
npm install
npm start
```

Scan the Expo QR code with Expo Go, or run on an emulator from the Expo developer tools.

## Voice Input

To enable automatic transcription, add your Gemini key to `.env`:

```bash
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

Then restart Expo with a clean cache:

```bash
npm start -- --clear
```

The voice modal records audio, sends it to Gemini, extracts task titles, and lets you review them before adding. Without a working API key, the modal still supports manual transcript entry so the task-splitting flow can be tested.

## Screenshots

Add real PNG or JPG screenshots from a device or emulator to the `screenshots` folder before submission.

Required files:

- `screenshots/task-list-empty.png`
- `screenshots/task-list-mixed.png`
- `screenshots/add-task.png`
- `screenshots/voice-input.png`
- `screenshots/dark-theme.png`

Embed them here after capturing:

![Task list empty](screenshots/task-list-empty.png)
![Task list mixed](screenshots/task-list-mixed.png)
![Add task](screenshots/add-task.png)
![Voice input](screenshots/voice-input.png)
![Dark theme](screenshots/dark-theme.png)
