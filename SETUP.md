# FilmShare - Setup Guide

Welcome to FilmShare! This guide will help you get the application up and running.

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- TMDB API key

## 🚀 Quick Start

### 1. **Setup Supabase Database**

1. Go to your Supabase project dashboard
2. Open the SQL Editor
3. Copy and paste the entire contents of `database/schema.sql`
4. Execute the SQL script

This will create:
- `users` table
- `movies` table
- `watched_logs` table
- `shares` table
- `follows` table
- All necessary indexes and RLS policies

### 2. **Environment Variables**

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Fill in your credentials:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `NEXT_PUBLIC_TMDB_API_KEY`: Your TMDB API key

### 3. **Install Dependencies**

```bash
npm install
```

### 4. **Run Development Server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── auth/              # Auth pages (login, signup)
│   ├── dashboard/         # Dashboard page
│   ├── share/             # Share movie page
│   ├── friends/           # Friends management page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home redirect
├── components/            # Reusable React components
│   ├── MovieCard.tsx
│   ├── Sidebar.tsx
│   ├── SearchBar.tsx
│   ├── UserCard.tsx
│   └── PageLayout.tsx
├── lib/                   # Utilities
│   ├── supabase.ts       # Supabase client
│   ├── auth.ts           # Auth functions
│   ├── tmdb.ts           # TMDB API functions
├── types/                # TypeScript type definitions
│   └── index.ts
└── hooks/                # Custom React hooks

database/
├── schema.sql            # Supabase database schema
```

---

## 🔐 Authentication Flow

1. **Signup**: Users create account with email, password, username, and name
2. **Username Validation**: Real-time check for availability
3. **Login**: Email/password authentication via Supabase
4. **Session**: Managed via Supabase JWT tokens in browser

---

## 🎬 Core Features

### Dashboard (`/dashboard`)
- View all movies shared to you
- Quick access to share and log movies
- Upcoming: Create lists, Movie Match

### Share Movies (`/share`)
- Search TMDB for movies
- Select recipients from friends
- Track all shares you've sent
- Delete shares

### Friends (`/friends`)
- **Discover**: Search all users
- **Following**: Friends you're following
- **Followers**: People following you
- **Requests**: Pending follow requests (with badge)

---

## 📊 Data Model

### Users
```sql
- id (UUID)
- username (unique)
- name
- avatar_url (optional)
- created_at
```

### Movies
```sql
- id (TMDB ID)
- title, poster_url, genres, platforms
- director, release_date, overview
- runtime, rating
```

### Watched Logs
```sql
- id, user_id, movie_id
- watched_at, notes
- seen, watch_later (booleans)
```

### Shares
```sql
- id, sender_id, receiver_id, movie_id
- created_at
```

### Follows
```sql
- id, follower_id, following_id
- status ('pending' or 'accepted')
- created_at
```

---

## 🛠️ Key Functions

### **Auth** (`lib/auth.ts`)
- `signUp()` - Register new user
- `signIn()` - Login user
- `signOut()` - Logout user
- `getCurrentUser()` - Fetch logged-in user
- `checkUsernameAvailability()` - Validate username

### **TMDB** (`lib/tmdb.ts`)
- `searchMovies()` - Search for movies
- `getMovieDetails()` - Fetch full movie info
- `getTMDBImageUrl()` - Build image URLs

---

## 🚀 Deployment

### **Vercel** (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel settings
4. Deploy

### **Environment Variables for Production**
- Ensure all `.env.local` variables are set in your hosting platform
- Use production Supabase URLs if applicable

---

## ⚠️ Important Notes

### Security
- Never commit `.env.local` to git
- Supabase RLS policies protect data at database level
- Users can only see their own shares and follows

### Rate Limiting
- TMDB API has rate limits (40 requests/10 seconds)
- Implement pagination for large datasets

### Next Steps (Phase 2)
- Add reactions (❤️🔥)
- Log movies feature (fully functional)
- Create lists
- Movie Match algorithm
- Google OAuth
- Notifications

---

## 🐛 Troubleshooting

### "RLS policy violation"
- Ensure the authenticated user has proper policies
- Check Supabase RLS settings

### "Movie not found" after share
- Movie might not exist in DB yet
- App auto-creates from TMDB data

### "Username taken" error
- Username must be unique
- Try a different username

---

## 📝 Development Tips

###  **Add New Features**
1. Create components in `src/components/`
2. Add types in `src/types/`
3. Create pages in `src/app/[feature]/`
4. Use `supabase` client for database queries

### **Database Changes**
1. Modify `database/schema.sql`
2. Run SQL in Supabase dashboard
3. Update types in `src/types/index.ts`

---

## 💡 Support

For issues or questions:
1. Check Supabase logs
2. Verify TMDB API key is valid
3. Ensure environment variables are correct

---

**Happy sharing! 🎬**
