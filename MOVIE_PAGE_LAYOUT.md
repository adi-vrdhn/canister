# MOVIE DETAIL PAGE LAYOUT DESIGN

## 🎬 LAYOUT STRUCTURE

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│             [BACKDROP HERO IMAGE - FULL WIDTH]              │
│                                                              │
│  [Back Button] ←  Movie Title  →  [Share Button] [Rate Btn] │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌─────────────┐                                             │
│  │   POSTER    │     Title: "Inception"                     │
│  │   IMAGE     │     Release: March 28, 2010                │
│  │  (overlap   │     Runtime: 148 min                       │
│  │  backdrop)  │     Director: Christopher Nolan            │
│  └─────────────┘     Genre: Sci-Fi, Action, Thriller       │
│                                                              │
│                      ⭐ 8.8/10 (1,234 ratings)              │
│                      ⭐ Friends avg: 8.5/10 (12 rated)     │
│                                                              │
│  Overview: A skilled thief who steals corporate secrets...   │
│  Lorem ipsum dolor sit amet, consectetur adipiscing elit.   │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  CAST & CREW                                                 │
│                                                              │
│  Director: Christopher Nolan                                 │
│  Writers: Christopher Nolan                                  │
│  Stars: Leonardo DiCaprio, Marion Cotillard, Ellen Page     │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  SENT BY FRIENDS                                             │
│                                                              │
│  "John sent this to you" ← [with date]                      │
│  Your friends who watched: [Avatars] John, Sarah, Mike      │
│  Their ratings: John ⭐⭐⭐⭐⭐ | Sarah ⭐⭐⭐⭐               │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  YOUR STATUS                                                 │
│                                                              │
│  ✅ You watched on April 8, 2026 [Edit] [—]                │
│  Your Rating: ⭐⭐⭐⭐ (4/5) [Change]                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  REVIEWS & COMMENTS                                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [Avatar] John Smith                      ⭐⭐⭐⭐⭐      │   │
│  │ 5 days ago                                           │   │
│  │ "This movie blew my mind! The plot twists are       │   │
│  │  incredible and the cinematography is stunning."     │   │
│  │ ♡ 12 likes    💬 3 replies                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [Avatar] Sarah Johnson                   ⭐⭐⭐⭐      │   │
│  │ 1 week ago                                           │   │
│  │ "Really good but confusing at times. Worth watching."│   │
│  │ ♡ 8 likes    💬 2 replies                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  [+ Load More Reviews]                                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  [Share with Friends Button] [Write a Review Button]         │
└──────────────────────────────────────────────────────────────┘
```

---

## 📦 COMPONENTS BREAKDOWN

### **1. Hero Backdrop Section**
- Full-width backdrop image
- Semi-dark overlay for text readability
- Back button (top-left)
- Movie title centered
- Action buttons: Share + Rate (top-right, sticky)

### **2. Main Content Card** 
- Poster overlaps backdrop (left side)
- Clean white background
- Title, Release Date, Runtime on right
- Director & Genre info
- Rating display (app avg + friends avg)
- Overview text (expandable)

### **3. Cast & Crew Section**
- Director name(s) 
- Writers/Screenplay
- Main cast list (top actors)
- Clickable to expand full credits

### **4. Sent By Friends Section**
- "Sent by [Friend Name]" with date
- Friends who also watched (avatars + names)
- Their individual ratings
- Only shows if accessed from a share

### **5. Your Status Section**
- Watched date (with edit/remove)
- Your rating (editable)
- All in a neat card

### **6. Reviews & Comments Section**
- Individual review cards with:
  - User avatar + name
  - Star rating
  - Review text (truncated)
  - Timestamp
  - Like count + reply count
- Load more button

### **7. Action Buttons** (Bottom sticky)
- Share with Friends
- Write a Review

---

## 🎨 DESIGN STYLE
- **Colors:** Clean whites, accent colors (blue for primary, red for accent like the artist profile)
- **Typography:** Bold headings, clean body text
- **Spacing:** Generous padding, clear sections
- **Cards:** Subtle shadows, rounded corners (8px)
- **Icons:** Lucide React icons for consistency

---

## ✅ DOES THIS LOOK GOOD?

**Questions before I build:**
1. Should the poster be **smaller/larger**?
2. Should reviews show **full text or truncated** by default?
3. Do you want a **"Write Review" modal** or just a button for now?
4. Should there be a **"Similar Movies" carousel** at the bottom?
5. Any color scheme preferences? (Blue + Red like the design? Or different?)

Let me know and I'll start building! 🚀
