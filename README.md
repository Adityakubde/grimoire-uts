# Grimoire

Grimoire is a single-page prompt vault for storing, organising, editing, copying, and reusing AI prompts. The project keeps the experience in one screen: the vault updates through `fetch` calls and DOM rendering, while Express and MongoDB handle persistence behind the scenes.

## Problem

Prompt collections usually end up scattered across notes apps, chat history, and random text files. Grimoire solves that by giving the user one place to:

- save prompt formulas
- group them into categories
- search and filter quickly
- track which prompts are actually being reused

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, Tailwind CDN, Vanilla JavaScript |
| Backend | Node.js, Express |
| Database | MongoDB Atlas with Mongoose |
| Deployment | Vercel |
| Design | Custom dark UI with responsive mobile and desktop layouts |
| Typography | Newsreader, Manrope, JetBrains Mono, Material Symbols |

## Core Workflow

1. Create a spell from the `Craft Spell` panel.
2. Save it to MongoDB with `Brew Spell`.
3. Browse the vault grid without reloading the page.
4. Filter by search, model, category, and sort order.
5. Open an existing spell, edit it, and save again.
6. Copy a spell directly from the card or detail panel.
7. Track usage count through copy events.
8. Rename or delete categories when the collection changes.

## Features

- Single-page application with one `index.html`
- Prompt CRUD: create, read, update, delete
- Category CRUD: create, read, rename, delete
- Search, model filtering, category filtering, and sorting
- Usage tracking through copy actions
- Sidebar category navigation with live counts
- Responsive UI:
  mobile drawer + bottom sheet
  desktop sidebar + detail panel
- Loading states, empty state, and toast feedback
- Easter egg modal hidden inside `Ministry Settings`

## Rubric Alignment

| Criterion | Evidence in this project |
|---|---|
| SPA | `public/index.html` is the single entry page. The frontend uses `fetch` + DOM updates in `public/app.js` and does not rely on page reloads for prompt/category actions. |
| All CRUD | Prompts support POST, GET, PATCH, DELETE. Categories support POST, GET, PATCH, DELETE. The frontend now exposes category rename so update is visible in the UI as well. |
| Business Logic | The app supports the full working flow: save, search/filter, open, edit, copy, delete. Copying also increments usage count, which feeds stats and usage sorting. |
| Presentation & UX | Dark themed interface, responsive sheet/panel layout, animated FAB, toasts, empty state, mobile support, and polished filter controls. |
| README | This file includes title, problem, stack, feature list, folder structure, setup, deployment, and development challenges. |
| Code Quality | Input is validated by Mongoose schemas and payload helpers, the frontend escapes rendered text with `escHtml`, and the server returns `400`, `404`, and `500` responses where appropriate. |

## Project Structure

```text
grimoire-uts/
|-- models/
|   |-- Category.js
|   `-- Prompt.js
|-- public/
|   |-- assets/
|   |   |-- easter-egg-preview.jpg
|   |   `-- easter-egg.webp
|   |-- app.js
|   `-- index.html
|-- .env.example
|-- package.json
|-- README.md
|-- server.js
`-- vercel.json
```

## API Summary

| Resource | Methods |
|---|---|
| `/api/prompts` | `GET`, `POST` |
| `/api/prompts/:id` | `GET`, `PATCH`, `DELETE` |
| `/api/prompts/:id/copy` | `POST` |
| `/api/categories` | `GET`, `POST` |
| `/api/categories/:id` | `PATCH`, `DELETE` |
| `/api/stats` | `GET` |

## Local Setup

1. Install dependencies with `npm install`.
2. Copy the template file with `Copy-Item .env.example .env`.
3. Add your MongoDB Atlas connection string to `.env`.
4. Start the development server with `npm run dev`.
5. Open `http://localhost:3000`.

## MongoDB Atlas Setup

1. Create a free MongoDB Atlas cluster.
2. Create a database user.
3. Allow your local IP and any deployment IPs you need.
4. Add the connection string to `.env`:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/grimoire?retryWrites=true&w=majority
```

## Deployment

1. Push the repository to GitHub.
2. Import the repo into Vercel.
3. Add `MONGODB_URI` in the Vercel project environment variables.
4. Deploy.

## Challenges

- Turning a design-heavy frontend into a real SPA meant replacing static blocks with dynamic render targets and state-driven UI updates.
- The frontend had to stay framework-free, so prompt state, filters, sheet visibility, and toasts are coordinated manually in `public/app.js`.
- MongoDB connection handling needed to work cleanly in both local Express runs and Vercel’s request-driven environment.
- Category deletion required follow-up business logic so prompts remain usable by falling back to `Uncategorised`.

## References

Tailwind component references for UI, sidebars, cards, filters, modals, and toast feedback used in this project:

- Tailwind Plus: https://tailwindcss.com/plus/ui-blocks
- Flowbite Components: https://flowbite.com/docs/components/
- Preline UI: https://preline.co/docs/
- HyperUI Components: https://www.hyperui.dev/
