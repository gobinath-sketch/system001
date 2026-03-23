<div align="center">
  <h1>🚀 GKT ERP System</h1>
  <p><strong>A Modern, Production-Grade Enterprise Resource Planning Solution</strong></p>
  
  [![React](https://img.shields.io/badge/React-19.2.0-blue.svg?style=flat&logo=react)](https://reactjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-Latest-green.svg?style=flat&logo=node.js)](https://nodejs.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-9.1.3-47A248.svg?style=flat&logo=mongodb)](https://www.mongodb.com/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-38B2AC.svg?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
  [![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101.svg?style=flat&logo=socket.io)](https://socket.io/)
</div>

<br />

## 🧱 1. PROJECT OVERVIEW

**GKT ERP** is a comprehensive, full-stack Enterprise Resource Planning built with the modern MERN stack. Designed to streamline business operations, it handles client management, opportunity tracking, multi-tier approvals, robust large-scale chat systems, and an AI-driven automated email processing pipeline.

**Problem Solved:** Legacy ERPs are often sluggish, lack real-time communication, and require manual data gathering. GKT ERP introduces a highly reactive frontend, websockets for instant chat/notifications, and integrates LLMs (GPT-4o-mini) to automate email parsing and response generation, driving extreme productivity.

---

## 🚀 2. FEATURES

### 🏢 Core ERP Functionality
* **Client & SME Management:** Keep comprehensive records of Clients and Subject Matter Experts (SMEs).
* **Opportunity Tracking:** Track business opportunities through various lifecycle stages.
* **Approval Workflows:** Secure, role-based approval structures for sensitive business operations.

### 💬 Real-Time Communication
* **Live Chat & Sockets:** Instant messaging via `socket.io`.
* **Large File Uploads:** Dedicated chunking strategy for files up to 100MB with a 15MB single-chunk limit.
* **Instant Notifications:** Real-time push alerts for approvals or mentions.

### 🤖 AI Automations
* **Outlook Integration:** Automated interactions with Microsoft Graph API using Azure AD (`n8n.automation.service`).
* **LLM Parsing:** AI-powered extraction and automation processing powered by OpenRouter (GPT-4o-mini).

### 🎨 Modern UI/UX
* **3D Visuals:** Immersive 3D data representations driven by `@react-three/fiber` and `three.js`.
* **Fully Responsive:** Styled continuously with Tailwind CSS v4 and Recharts for dynamic visual dashboards.

---

## 🏗️ 3. SYSTEM ARCHITECTURE

The project utilizes a decoupled **Client-Server Architecture** (Monolith Backend).

```text
+---------------------+        HTTP / REST        +-----------------------+
|  Frontend (React)   | <=======================> |   Backend (Node.js)   |
|  - Vite, Tailwind   |       WebSockets          |   - Express, Socket.io|
|  - Zustand / Context| <-----------------------> |   - Bcrypt, JWT Auth  |
+---------------------+                           +-----------+-----------+
         |                                                    |
         v                                                    v
+---------------------+                           +-----------------------+
| Email/Graph API     |                           |       Database        |
| - Azure AD Services |                           |   - MongoDB Atlas     |
+---------------------+                           +-----------------------+
```

---

## 🛠️ 4. TECH STACK

### 🌐 Frontend
* **React 19 & Vite** (High-performance rendering and incredibly fast HMR)
* **Tailwind CSS v4** (Utility-first atomic styling)
* **Three.js & React-Three-Fiber** (Interactive 3D dashboards)
* **Recharts** (Declarative data visualizations)
* **Socket.io-client** (Real-time reactivity)

### ⚙️ Backend
* **Node.js & Express.js** (Non-blocking I/O robust server API)
* **Socket.io** (Bidirectional event-driven communication)
* **JWT & Bcrypt** (Secure, stateless authentication)
* **Multer** (Multipart/form-data handling for file uploads)

### 🗄️ Database
* **MongoDB & Mongoose 9.1** (NoSQL, optimized for schema flexibility and large JSON blobs)

### 🤖 AI / DevOps
* **Azure Graph API** (Enterprise email auth/processing)
* **OpenRouter** (Unified LLM gateway)

---

## 📁 5. PROJECT STRUCTURE

```text
erp/
├── client/                     # React Frontend Application
│   ├── src/
│   │   ├── assets/             # Static images, fonts, icons
│   │   ├── components/         # Reusable UI components
│   │   ├── config/             # Environment & App Configs (e.g., api.js)
│   │   ├── constants/          # Static app data
│   │   ├── context/            # React Context state management
│   │   ├── pages/              # Main route views
│   │   └── utils/              # Frontend helper functions
│   ├── package.json
│   └── index.css               # Global Tailwind CSS directives
│
└── server/                     # Node.js Express Backend API
    ├── config/                 # DB connections & environment setup
    ├── controllers/            # Request handlers (logic layer)
    ├── data/                   # Default configuration data
    ├── email-automation/       # Custom Outlook automated mail modules
    ├── exports/                # Exported CSVs/reports (exceljs)
    ├── middleware/             # Auth guards & file validators
    ├── models/                 # Mongoose DB schemas
    ├── routes/                 # Express API endpoints
    ├── services/               # Complex business logic
    ├── test-output/            # Sandbox for tests
    ├── uploads/                # Chat chunked/binary user uploads
    └── utils/                  # Backend helpers & cryptographic utils
```

---

## ⚙️ 6. INSTALLATION & SETUP

### Prerequisites
* Node.js (v18+ recommended)
* MongoDB (Local instance or Atlas URI)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/gkt-erp.git
cd gkt-erp
```

### 2. Install Dependencies
**Backend:**
```bash
cd server
npm install
```

**Frontend:**
```bash
cd ../client
npm install
```

### 3. Setup Environment Variables
Duplicate the `.env.example` in both directories to `.env` and fill the variables (See section below).

---

## 🔐 7. ENVIRONMENT VARIABLES

Ensure the `server/.env` is configured correctly:

| Variable Name | Description | Example |
|---------------|-------------|---------|
| `PORT` | Node.js Server Port | `5000` |
| `MONGO_URI` | MongoDB Connection String | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `JWT_SECRET` | Secret key for JWT signing | `d3b07384...27f9` |
| `CHAT_MAX_FILE_SIZE_BYTES` | Upload limit for chat payloads | `104857600` (100MB) |
| `AZURE_CLIENT_ID` | Microsoft Entra App ID | `ac1c0bd1-...` |
| `OPENROUTER_API_KEY` | Key for automated LLM queries | `sk-or-v1-...` |
| `EMAIL_AUTOMATION_MODEL`| Default parsing LLM | `openai/gpt-4o-mini` |

---

## ▶️ 8. RUNNING THE PROJECT

This application uses concurrent execution environments. You will need two terminal windows.

**Running the Backend (Development Mode)**
```bash
cd server
npm run dev
```
*(Runs with nodemon on port 5000)*

**Running the Frontend (Development Mode)**
```bash
cd client
npm run dev
```
*(Runs with Vite on port 5173)*

---

## 🌐 9. API DOCUMENTATION

*Below are core high-level endpoints. See source for exact payloads:*

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/login` | Authenticates User & Returns JWT | ❌ |
| `GET`  | `/api/opportunities` | Fetches active project opportunities | ✅ |
| `POST` | `/api/opportunities` | Creates a new opportunity | ✅ |
| `GET`  | `/api/clients` | Retrieve all registered clients | ✅ |
| `GET`  | `/api/approvals` | Retrieve pending system approvals | ✅ |
| `POST` | `/api/chat/upload` | Chunked multi-part chat file uploads | ✅ |

---

## 🧪 10. TESTING

*The project does not currently enforce a strict test suite, but can be added in `server/package.json`.*

To implement basic testing logic:
1. Integrate `Jest` / `Supertest` in the backend.
2. Integrate `Vitest` / `React Testing Library` in the frontend.

---

## 🚀 11. DEPLOYMENT

### Production Build (Frontend)
```bash
cd client
npm run build
```
The output directory will be `dist/`.

### Hosting Strategy
* **Frontend:** Deploy the `dist` folder to Vercel, Netlify, or Azure Static Web Apps.
* **Backend:** Deploy the `server` directory to an AWS EC2 instance, Heroku, or Azure App Service.
* **Database:** Best utilized with **MongoDB Atlas** for managed clustering and replication.

---

## 🔄 12. WORKFLOW / DATA FLOW

1. **User Authentication:** HTTP POST authenticates users returning an HttpOnly cookie or Bearer token.
2. **Socket Initialization:** Upgrades connection to WSS over port 5000.
3. **Email Pipeline:** Target emails are monitored via Microsoft Graph API. Incoming mail hitting `MAIL_AUTOMATION_AUTO_THRESHOLD` triggers an Azure webhook.
4. **AI Generation:** The backend forwards the email body to OpenRouter (GPT-4o-mini), generates structured JSON action items, and populates the CRM.
5. **Realtime Broadcast:** Clients listening via WebSockets immediately reflect the UI changes (e.g. notifications/new chat).

---

## 🔒 13. SECURITY

* **Data Encryption:** Passwords are mathematically hashed via `bcryptjs`.
* **Token Protection:** Stateless access with `jsonwebtoken` mapped against user roles (`Business Head`, etc.).
* **CORS Limits:** Enforced tightly using Express `cors` middleware protecting HTTP operations.
* **Payload Trimming:** Multer and Socket file chunking specifically protect against memory-overload DDOS payloads.

---

## 📊 14. SCALABILITY & PERFORMANCE

* **Horizontal Scaling Node:** Designed statelessly; easily clustered via PM2 (`pm2 start index.js -i max`).
* **MongoDB Indexing:** Ensure indices on heavily queried paths (like `client_email`, `opportunity_status`).
* **Vite Static Asset Splitting:** `npm run build` heavily chunks and caches React vendor assets for blazing fast edge delivery.

---

## ⚠️ 15. ERROR HANDLING

* **API Level:** Global Error Catching Express middleware ensures exact 500/404 messages are output cleanly in JSON rather than crashing the Node thread.
* **UI Level:** Graceful degradation on Axios failures through standard React Error Boundaries.
* **Fallback Systems:** In the event of an OpenRouter API timeout, email-automation gracefully flags items as manual review `status: unprocessed`.

---

## 🤝 16. CONTRIBUTION GUIDE

1. Fork the repo and create your branch from `main`.
2. Ensure you format standard code using `npm run lint` in the client.
3. If you've modified schemas, update the relevant `exports/` adapters.
4. Issue a pull request with a thorough description of changes!

---

## 📜 17. LICENSE

This project is licensed under the **ISC License**. See the `LICENSE` file for details.

---

## 👨💻 18. AUTHOR / TEAM

Developed and engineered by **Gobinath M / GKT**  
*(Focusing on advanced enterprise architecture and modern full-stack workflows.)*

---

## 📌 19. FUTURE IMPROVEMENTS

* Implement Redis caching layer for heavy analytics DB groupings.
* Add comprehensive E2E playwright testing.
* Migrate pure JavaScript React components strictly to TypeScript for type safety.
* Support offline-PWA capabilities for remote SME data-entry.

---

*Generated for maximum impact. A 1% benchmark implementation.*
