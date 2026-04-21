# FilmShare - Social Movie Sharing Platform 🎬

A clean, minimal web app where users can share movies with specific people, log what they've watched, and follow friends.

**Tech Stack**: Next.js 15 + Tailwind CSS + Supabase + TMDB API

---

## ✨ Features

### 🎯 Core MVP

- **Authentication**: Email/password signup and login
- **Dashboard**: View movies shared to you
- **Share Movies**: Search TMDB, select friends, send movie shares
- **Friends**: Discover users, follow with approval system
- **Logged Movies**: Track watched movies (UI placeholder for Phase 1)

### 📱 User Flows

1. **Share**: Search movie → Select recipients → Send
2. **Follow**: Search users → Send request → Accept/pending badge
3. **Dashboard**: See all movies shared to you with sender names

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- TMDB API key

### Setup

1. **Clone and install**
   ```bash
   npm install
   ```

2. **Configure environment** (see [SETUP.md](./SETUP.md))
   ```bash
   cp .env.local.example .env.local
   ```

3. **Setup Supabase**
   - Run SQL from `database/schema.sql` in Supabase dashboard

4. **Run development**
   ```bash
   npm run dev
   ```

→ Open [http://localhost:3000](http://localhost:3000)

---

## 📖 Full Documentation

See [SETUP.md](./SETUP.md) for:
- Detailed setup instructions
- Database schema
- Project structure
- Deployment guide
- Troubleshooting

---

## 🎨 UI Components

### Reusable
- `MovieCard` - Movie poster with metadata
- `Sidebar` - Navigation & profile
- `SearchBar` - Live search dropdown
- `UserCard` - User badge with follow status
- `PageLayout` - Sidebar + content wrapper

---

## 🗄️ Database

Tables: `users`, `movies`, `watched_logs`, `shares`, `follows`

Key relations:
- Users have many shares (sent/received)
- Users can follow each other (with status)
- Movies can be shared multiple times
- Watched logs are per user per movie

**Security**: Row-Level Security (RLS) policies enforce data access

---

## 🎯 Phase 1 Scope (MVP)

✅ Auth (signup/login)  
✅ Dashboard  
✅ Share movies  
✅ Friends management  
✅ Follow system  
⏭️ Watched logs (UI only)  
⏭️ Reactions (coming Phase 2)  
⏭️ Create lists (coming Phase 2)  

---

## 🚀 Deployment

```bash
npm run build
npm run start
```

Deploy to Vercel - set environment variables in dashboard.

---

**Built with ❤️ for movie lovers**
