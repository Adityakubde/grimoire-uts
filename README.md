# Grimoire - AI Prompt Vault

## What It Does
Grimoire is a single-page prompt vault for saving, editing, filtering, copying, and deleting AI prompts.

The interface is based on a Stitch-generated design and the app is wired to an Express + MongoDB backend with vanilla JavaScript on the frontend.

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | HTML, Tailwind CDN, Vanilla JavaScript |
| Backend | Node.js, Express |
| Database | MongoDB Atlas with Mongoose |
| Deployment | Vercel |
| Fonts | Newsreader, Manrope, JetBrains Mono |

## Features
- Create, read, update, and delete prompts
- Filter by search term, model, and category
- Sort by recent, rating, and usage
- Rate prompts with stars
- Manage categories from the sidebar
- Copy prompt bodies with usage tracking
- Seed default categories on first database connection
- Responsive single-page layout with a mobile bottom sheet and desktop side panel

## Project Structure
```text
grimoire-uts/
|-- models/
|   |-- Category.js
|   `-- Prompt.js
|-- public/
|   |-- app.js
|   `-- index.html
|-- .env.example
|-- .gitignore
|-- package.json
|-- server.js
`-- vercel.json
```

## Local Setup
1. Install dependencies:
   `npm install`
2. Copy the environment template:
   `Copy-Item .env.example .env`
3. Add your MongoDB Atlas connection string to `.env`.
4. Start the app:
   `npm run dev`
5. Open `http://localhost:3000`

## MongoDB Atlas Setup
1. Create a free M0 cluster in MongoDB Atlas.
2. Create a database user with a username and password.
3. In Network Access, allow `0.0.0.0/0` for Vercel compatibility.
4. Copy the connection string and replace the placeholder in `.env`:
   `MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/grimoire?retryWrites=true&w=majority`

## Vercel Deployment
1. Push the repository to GitHub.
2. Import the repo into Vercel.
3. Add `MONGODB_URI` in Project Settings -> Environment Variables.
4. Deploy. Every push to `main` will trigger a new deployment.

## Challenges
- Stitch generated a static layout, so the UI needed explicit DOM hooks and dynamic rendering points for the prompt grid, category list, and detail sheet.
- MongoDB connection handling had to stay friendly for both local Express runs and Vercel serverless execution.
- Vanilla JavaScript kept the app simple, but it meant carefully coordinating UI state, inline actions, and API responses without a framework.
