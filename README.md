# Grimoire Prompt Vault

Grimoire is a single-page prompt vault for storing, organising, editing, copying, and reusing prompt templates. Assignment 2 keeps the original Grimoire interface while adding React, Firebase Authentication, Cloud Firestore, JWT-protected Express routes, and admin account management.

## Problem

Prompt templates are easy to lose when they are spread across notes apps, chat history, and text files. Grimoire gives users one place to:

- save reusable prompt formulas
- group prompts into categories
- search and filter prompts quickly
- track which prompts are reused
- let an admin manage accounts and review user activity

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | Cloud Firestore |
| Authentication | Firebase Authentication with email/password sign-in |
| Security | Firebase ID token verification, role-based API checks |
| Styling | Existing Grimoire dark UI, Tailwind CDN utilities, custom CSS |

## Rubric Mapping

| Rubric Area | Evidence in this project |
|---|---|
| Suitability and comprehensiveness | Grimoire is a realistic prompt-management app with account ownership, categories, search, reuse tracking, and admin oversight. |
| Three CRUD entities | `users`, `prompts`, and `categories` each support create, read, update, and delete/soft-delete behavior. |
| Business, design, and performance | Users own their vault records, categories organise prompts, admins manage accounts, and live search runs in React state without page reloads. |
| README | This file includes the problem, stack, dependencies, setup steps, folder structure, API summary, rubric mapping, and workload allocation. |
| Workload allocation | The project is documented as an individual submission by Aditya with file-area ownership listed below. |
| Individual features | Auth, JWT verification, role-based access control, CRUD routes, live search, admin panel, activity logs, loading states, and error states are implemented. |
| Code quality | Frontend modules are separated by responsibility, backend helpers keep route logic readable, and validation errors are returned as clear messages. |
| Professional practice | Secrets are kept in `.env`, `.env.example` uses placeholders, and the Firebase Admin key file is not committed. |

## Assignment Requirement Mapping

| Requirement | Implementation |
|---|---|
| Modern frontend library | React app in `src/` built with Vite |
| SPA behavior | One root `index.html`; React changes views without loading new pages |
| Backend + database | Express API in `server.js`; Cloud Firestore collections store app data |
| Registration/login | Firebase Authentication email/password flow in `AuthPanel.jsx` |
| Password hashing + JWT | Firebase Authentication manages password storage and issues Firebase ID tokens, which are JWTs |
| CRUD entity 1 | Users: create profile on first session, read list/detail, update account fields through the API, and soft delete by disabling account |
| CRUD entity 2 | Prompts: create, read, update, delete, copy-count tracking |
| CRUD entity 3 | Categories: create, read, rename/update, delete |
| Live search | Existing search bar filters prompt cards immediately through React state |
| Admin view | Admin panel shows user accounts and recent activity logs |
| Role-based access | Express middleware protects admin-only routes |
| Error handling | API returns clear `400`, `401`, `403`, `404`, and `500` messages; UI shows errors without a blank page |

## Folder Structure

```text
grimoire-uts/
|-- api/
|   `-- index.js              Vercel Function entrypoint for Express API
|-- public/
|   `-- assets/               Shared Grimoire images and icon assets
|-- src/
|   |-- components/
|   |   |-- AdminPanel.jsx     Admin user/activity view
|   |   |-- AuthPanel.jsx      Login and registration panel
|   |   `-- VaultApp.jsx       Main vault interface and CRUD UI
|   |-- api.js                Shared API request helper
|   |-- App.jsx               Auth/session gate
|   |-- firebaseClient.js     Firebase Web SDK setup
|   |-- main.jsx              React entrypoint
|   |-- styles.css            Preserved Grimoire styling
|   `-- utils.js              Formatting and tag helpers
|-- .env.example              Environment variable template
|-- index.html                Single HTML entrypoint
|-- package.json              Scripts and dependencies
|-- README.md                 Assignment documentation
|-- server.js                 Express API, Firebase Admin, Firestore CRUD
|-- vercel.json               Vercel build and routing config
|-- vite.config.mjs           Vite dev-server and API proxy config
`-- .vercelignore             Files excluded from Vercel deploy uploads
```


## How To Test

1. Add the demo admin email to `ADMIN_EMAILS`, then register that account.
2. Create, edit, search, copy, and delete a spell.
3. Create, rename, and delete a category.
4. Register another user and confirm they can only access their own vault.
5. Log back in as admin and open the Admin Panel.
6. Delete a normal user account and review recent activity logs.
7. Confirm a normal user cannot access admin routes.


## API Summary

| Resource | Methods |
|---|---|
| `/api/auth/session` | `POST` |
| `/api/auth/logout` | `POST` |
| `/api/auth/me` | `GET` |
| `/api/prompts` | `GET`, `POST` |
| `/api/prompts/:id` | `GET`, `PATCH`, `DELETE` |
| `/api/prompts/:id/copy` | `POST` |
| `/api/categories` | `GET`, `POST` |
| `/api/categories/:id` | `PATCH`, `DELETE` |
| `/api/users` | `GET` admin only |
| `/api/users/:id` | `GET`, `PATCH`, `DELETE` admin only |
| `/api/activities` | `GET` |
| `/api/stats` | `GET` |

## Workload Allocation

Individual submission by Aditya.

| Area | Files |
|---|---|
| Frontend React SPA | `src/App.jsx`, `src/components/*`, `src/api.js`, `src/firebaseClient.js`, `src/utils.js`, `src/styles.css`, `index.html` |
| Backend API and security | `server.js` |
| Firebase setup | `.env.example`, Firebase Auth, Firestore collections |
| Project setup and deployment | `package.json`, `vite.config.mjs`, `vercel.json`, `api/index.js`, `.vercelignore`, `README.md` |

## Security Notes

- Passwords are handled by Firebase Authentication and are never stored in Firestore.
- The Firebase Admin private key is only used by `server.js`.
- Admin emails are configured in server-only `.env`; admin routes check `profile.role === "admin"` before managing users.
- User deletion is a soft delete using `isActive = false` plus Firebase account disabling.


## References

- Firebase Auth: https://firebase.google.com/docs/auth
- Password-based auth: https://firebase.google.com/docs/auth/web/password-auth
- Firebase ID tokens and sessions: https://firebase.google.com/docs/auth/admin/manage-sessions
- Firebase password hash parameters: https://firebase.google.com/docs/cli/auth
