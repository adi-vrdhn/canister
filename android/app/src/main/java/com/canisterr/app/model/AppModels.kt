package com.canisterr.app.model

import androidx.compose.ui.graphics.Color

enum class AppTab {
    Home,
    Discover,
    Logs,
    Profile,
}

data class RatingBucket(
    val label: String,
    val count: Int,
    val color: Color,
)

data class MovieCardData(
    val id: Int,
    val title: String,
    val year: String,
    val genre: String,
    val runtime: String,
    val rating: String,
    val synopsis: String,
    val accent: Color,
    val posterTone: Color,
    val logCount: Int,
    val reviewCount: Int,
    val watchedCount: Int,
    val myReview: String? = null,
    val friendWatchers: List<String> = emptyList(),
    val ratingBuckets: List<RatingBucket> = emptyList(),
)

data class FriendActivityData(
    val friendName: String,
    val movieTitle: String,
    val timeAgo: String,
    val verdict: String,
    val accent: Color,
)

data class LogEntryData(
    val friendName: String,
    val movieTitle: String,
    val reaction: String,
    val note: String,
    val timeAgo: String,
    val posterTone: Color,
)

data class ProfileStatData(
    val label: String,
    val value: String,
)

data class AppContent(
    val movies: List<MovieCardData>,
    val friendActivity: List<FriendActivityData>,
    val logs: List<LogEntryData>,
    val profileStats: List<ProfileStatData>,
)

val sampleMovies = listOf(
    MovieCardData(
        id = 1,
        title = "Babygirl",
        year = "2024",
        genre = "Drama",
        runtime = "114 min",
        rating = "GOOD",
        synopsis = "A sharp, uneasy, and stylish character study with a quiet emotional burn.",
        accent = Color(0xFFFF8C1A),
        posterTone = Color(0xFF133A40),
        logCount = 1,
        reviewCount = 1,
        watchedCount = 1,
        myReview = "Stylish and unsettling in the best way. The performances carry the whole thing.",
        friendWatchers = listOf("Dipanki", "Aarav", "Mira", "Rohan", "Tia", "Neil", "Sara", "Kabir", "Zoya", "Adi"),
        ratingBuckets = listOf(
            RatingBucket("Bad", 0, Color(0xFFFF6384)),
            RatingBucket("Average", 0, Color(0xFFFFBE0B)),
            RatingBucket("Good", 1, Color(0xFF00D084)),
            RatingBucket("Masterpiece", 0, Color(0xFFFF8C1A)),
        ),
    ),
    MovieCardData(
        id = 2,
        title = "Good Fortune",
        year = "2025",
        genre = "Comedy",
        runtime = "102 min",
        rating = "GOOD",
        synopsis = "Bright, playful, and easy to watch. A soft crowd-pleaser with personality.",
        accent = Color(0xFF34D399),
        posterTone = Color(0xFF30335A),
        logCount = 3,
        reviewCount = 2,
        watchedCount = 3,
        myReview = null,
        friendWatchers = listOf("Dipanki", "Aarav", "Mira", "Rohan", "Tia", "Neil", "Sara", "Kabir", "Zoya", "Adi"),
        ratingBuckets = listOf(
            RatingBucket("Bad", 0, Color(0xFFFF6384)),
            RatingBucket("Average", 1, Color(0xFFFFBE0B)),
            RatingBucket("Good", 2, Color(0xFF00D084)),
            RatingBucket("Masterpiece", 0, Color(0xFFFF8C1A)),
        ),
    ),
    MovieCardData(
        id = 3,
        title = "The Devil Wears Prada 2",
        year = "2026",
        genre = "Comedy",
        runtime = "120 min",
        rating = "AVERAGE",
        synopsis = "A glossy sequel concept with sharp fashion energy and a familiar spark.",
        accent = Color(0xFFEF4444),
        posterTone = Color(0xFF5B1C1C),
        logCount = 5,
        reviewCount = 4,
        watchedCount = 4,
        myReview = "Pure style. Not quite as iconic as the first, but still fun to stare at.",
        friendWatchers = listOf("Dipanki", "Aarav", "Mira", "Rohan", "Tia", "Neil", "Sara", "Kabir", "Zoya", "Adi"),
        ratingBuckets = listOf(
            RatingBucket("Bad", 1, Color(0xFFFF6384)),
            RatingBucket("Average", 2, Color(0xFFFFBE0B)),
            RatingBucket("Good", 1, Color(0xFF00D084)),
            RatingBucket("Masterpiece", 1, Color(0xFFFF8C1A)),
        ),
    ),
)

val sampleFriendActivity = listOf(
    FriendActivityData("Dipanki", "Babygirl", "7d ago", "GOOD", Color(0xFF133A40)),
    FriendActivityData("Aarav", "Good Fortune", "3d ago", "GOOD", Color(0xFF30335A)),
    FriendActivityData("Mira", "The Devil Wears Prada 2", "1d ago", "AVERAGE", Color(0xFF5B1C1C)),
)

val sampleLogs = listOf(
    LogEntryData(
        friendName = "Aditya",
        movieTitle = "Babygirl",
        reaction = "GOOD",
        note = "Lowkey, it is less about drama and more about finding your people while you are still figuring yourself out.",
        timeAgo = "7d ago",
        posterTone = Color(0xFF133A40),
    ),
    LogEntryData(
        friendName = "Dipanki",
        movieTitle = "Good Fortune",
        reaction = "GOOD",
        note = "Very easy watch. Good energy, good pacing, and the kind of movie that makes a rainy night better.",
        timeAgo = "3d ago",
        posterTone = Color(0xFF30335A),
    ),
    LogEntryData(
        friendName = "Mira",
        movieTitle = "The Devil Wears Prada 2",
        reaction = "AVERAGE",
        note = "Fashion is doing all the heavy lifting, but that is still half the fun.",
        timeAgo = "1d ago",
        posterTone = Color(0xFF5B1C1C),
    ),
)

val profileStats = listOf(
    ProfileStatData("Movies Logged", "128"),
    ProfileStatData("Followers", "89"),
    ProfileStatData("Following", "74"),
)
