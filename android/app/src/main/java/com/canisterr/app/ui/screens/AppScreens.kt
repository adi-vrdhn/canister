package com.canisterr.app.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Movie
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.PaddingValues
import com.canisterr.app.model.AppTab
import com.canisterr.app.model.AppContent
import com.canisterr.app.model.FriendActivityData
import com.canisterr.app.model.LogEntryData
import com.canisterr.app.model.MovieCardData
import com.canisterr.app.model.RatingBucket
import com.canisterr.app.data.AppContentRepository
import com.canisterr.app.data.DemoAppContentRepository
import com.canisterr.app.ui.theme.CanisterrBackground
import com.canisterr.app.ui.theme.CanisterrBorder
import com.canisterr.app.ui.theme.CanisterrPrimary
import com.canisterr.app.ui.theme.CanisterrPrimarySoft
import com.canisterr.app.ui.theme.CanisterrSurface
import com.canisterr.app.ui.theme.CanisterrSurfaceAlt
import com.canisterr.app.ui.theme.CanisterrText
import com.canisterr.app.ui.theme.CanisterrTextSoft

@Composable
fun CanisterrApp(contentRepository: AppContentRepository = DemoAppContentRepository()) {
    var contentState by remember(contentRepository) {
        mutableStateOf<AppContentState>(AppContentState.Loading)
    }
    var selectedTab by rememberSaveable { mutableStateOf(AppTab.Home) }
    var selectedMovieId by rememberSaveable { mutableStateOf<Int?>(null) }

    LaunchedEffect(contentRepository) {
        contentState = try {
            val content = contentRepository.loadContent()
            AppContentState.Ready(content)
        } catch (error: Throwable) {
            AppContentState.Error(
                message = error.message ?: "Unable to load Canisterr content right now."
            )
        }
    }

    val readyContent = (contentState as? AppContentState.Ready)?.content
    val selectedMovie = remember(selectedMovieId, readyContent) {
        readyContent?.movies?.firstOrNull { it.id == selectedMovieId }
    }

    when (val state = contentState) {
        is AppContentState.Loading -> {
            LoadingScreen()
            return
        }
        is AppContentState.Error -> {
            ErrorScreen(message = state.message)
            return
        }
        is AppContentState.Ready -> {
            // Continue into the app shell below.
        }
    }

    val appContent = readyContent ?: return

    BackHandler(enabled = selectedMovie != null) {
        selectedMovieId = null
    }

    if (selectedMovie != null) {
        MovieDetailScreen(
            movie = selectedMovie,
            onBack = { selectedMovieId = null },
            onMovieSelected = { selectedMovieId = it },
        )
        return
    }

    Scaffold(
        containerColor = CanisterrBackground,
        bottomBar = {
            NavigationBar(
                containerColor = CanisterrSurface,
                tonalElevation = 0.dp,
            ) {
                AppTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab },
                        icon = {
                            Icon(
                                imageVector = when (tab) {
                                    AppTab.Home -> Icons.Outlined.Home
                                    AppTab.Discover -> Icons.Outlined.TrendingUp
                                    AppTab.Logs -> Icons.Outlined.Movie
                                    AppTab.Profile -> Icons.Outlined.PersonOutline
                                },
                                contentDescription = tab.name,
                            )
                        },
                        label = {
                            Text(
                                text = tab.name,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        },
                    )
                }
            }
        },
    ) { padding ->
        when (selectedTab) {
            AppTab.Home -> HomeScreen(
                modifier = Modifier.padding(padding),
                content = appContent,
                onMovieSelected = { selectedMovieId = it },
            )
            AppTab.Discover -> DiscoverScreen(
                modifier = Modifier.padding(padding),
                movies = appContent.movies,
                onMovieSelected = { selectedMovieId = it },
            )
            AppTab.Logs -> LogsScreen(modifier = Modifier.padding(padding), logs = appContent.logs)
            AppTab.Profile -> ProfileScreen(modifier = Modifier.padding(padding), stats = appContent.profileStats)
        }
    }
}

private sealed interface AppContentState {
    data object Loading : AppContentState
    data class Ready(val content: AppContent) : AppContentState
    data class Error(val message: String) : AppContentState
}

@Composable
private fun LoadingScreen() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(CanisterrBackground),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Canisterr", style = MaterialTheme.typography.displayLarge, color = CanisterrText)
            Text("Loading your feed...", color = CanisterrTextSoft)
        }
    }
}

@Composable
private fun ErrorScreen(message: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(CanisterrBackground),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Something went wrong", style = MaterialTheme.typography.titleLarge, color = CanisterrText)
            Text(message, color = CanisterrTextSoft, textAlign = TextAlign.Center)
        }
    }
}

@Composable
fun HomeScreen(
    modifier: Modifier = Modifier,
    content: AppContent,
    onMovieSelected: (Int) -> Unit,
) {
    val featuredMovie = content.movies.first()

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(CanisterrBackground),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "Canisterr",
                    style = MaterialTheme.typography.displayLarge,
                    color = CanisterrText,
                )
                Text(
                    text = "Movies, logs, and the people you watch with.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = CanisterrTextSoft,
                )
                SearchBar()
                FeaturedMovieCard(movie = featuredMovie, onClick = { onMovieSelected(featuredMovie.id) })
            }
        }

        item {
            SectionHeader(title = "Friends Activity", subtitle = "Recent watches from your circle")
        }

        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(content.friendActivity.size) { index ->
                    val activity = content.friendActivity[index]
                    FriendActivityCard(activity = activity)
                }
            }
        }

        item {
            SectionHeader(title = "Trending Now", subtitle = "The titles people keep opening")
        }

        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(content.movies.size) { index ->
                    val movie = content.movies[index]
                    PosterMovieCard(movie = movie, onClick = { onMovieSelected(movie.id) })
                }
            }
        }

        item {
            SectionHeader(title = "Recent Logs", subtitle = "Fresh reactions and quick takes")
        }

        items(content.logs.size) { index ->
            LogCard(entry = content.logs[index])
        }
    }
}

@Composable
fun DiscoverScreen(
    modifier: Modifier = Modifier,
    movies: List<MovieCardData>,
    onMovieSelected: (Int) -> Unit,
) {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(144.dp),
        modifier = modifier
            .fillMaxSize()
            .background(CanisterrBackground),
        contentPadding = PaddingValues(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(maxLineSpan) }) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Discover", style = MaterialTheme.typography.displayLarge, color = CanisterrText)
                Text("A simple native starting point for your movie feed.", color = CanisterrTextSoft)
            }
        }

        items(movies.size) { index ->
            val movie = movies[index]
            PosterMovieCard(movie = movie, onClick = { onMovieSelected(movie.id) })
        }
    }
}

@Composable
fun LogsScreen(modifier: Modifier = Modifier, logs: List<LogEntryData>) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(CanisterrBackground),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Logs", style = MaterialTheme.typography.displayLarge, color = CanisterrText)
                Text("A home for watch history, reviews, and reactions.", color = CanisterrTextSoft)
            }
        }

        items(logs.size) { index ->
            LogCard(entry = logs[index])
        }
    }
}

@Composable
fun ProfileScreen(modifier: Modifier = Modifier, stats: List<com.canisterr.app.model.ProfileStatData>) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(CanisterrBackground),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Surface(
                color = CanisterrSurface,
                shape = RoundedCornerShape(28.dp),
                tonalElevation = 0.dp,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(72.dp)
                                .clip(RoundedCornerShape(24.dp))
                                .background(
                                    Brush.linearGradient(
                                        listOf(CanisterrPrimary, CanisterrPrimarySoft),
                                    )
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = "G",
                                style = MaterialTheme.typography.headlineMedium,
                                color = Color.Black,
                            )
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text("gayatri", style = MaterialTheme.typography.headlineMedium, color = CanisterrText)
                            Text("@goiisome", color = CanisterrPrimarySoft)
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                        stats.forEach { stat ->
                            StatCard(
                                title = stat.label,
                                value = stat.value,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MovieDetailScreen(
    movie: MovieCardData,
    onBack: () -> Unit,
    onMovieSelected: (Int) -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(CanisterrBackground),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Outlined.ArrowBack, contentDescription = "Back", tint = CanisterrText)
                    }
                    Text("Back", color = CanisterrText, style = MaterialTheme.typography.titleMedium)
                }

                PosterHero(movie = movie)

                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = movie.title,
                        style = MaterialTheme.typography.displayLarge,
                        color = CanisterrText,
                    )
                    Text(
                        text = "${movie.year} • ${movie.runtime} • ${movie.genre}",
                        color = CanisterrTextSoft,
                    )
                    Text(movie.synopsis, color = CanisterrText)
                }

                ActionRow()
            }
        }

        item {
            RatingSection(movie = movie)
        }

        if (movie.myReview != null) {
            item {
                MyReviewCard(review = movie.myReview)
            }
        }

        item {
            StatsRow(movie = movie)
        }

        item {
            FriendsWhoWatchedIt(movie = movie, onMovieSelected = onMovieSelected)
        }
    }
}

@Composable
private fun SearchBar() {
    var query by rememberSaveable { mutableStateOf("") }

    OutlinedTextField(
        value = query,
        onValueChange = { query = it },
        modifier = Modifier.fillMaxWidth(),
        placeholder = { Text("Search movies, shows, and usernames...") },
        leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
        singleLine = true,
    )
}

@Composable
private fun FeaturedMovieCard(movie: MovieCardData, onClick: () -> Unit) {
    ElevatedCard(
        onClick = onClick,
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.elevatedCardColors(containerColor = CanisterrSurface),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 0.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            PosterPlaceholder(movie = movie, height = 240.dp)
            Text(movie.title, style = MaterialTheme.typography.headlineMedium, color = CanisterrText)
            Text(movie.synopsis, color = CanisterrTextSoft)
            AssistChip(
                onClick = onClick,
                label = { Text("Open detail") },
                colors = AssistChipDefaults.assistChipColors(containerColor = CanisterrSurfaceAlt),
            )
        }
    }
}

@Composable
private fun PosterMovieCard(movie: MovieCardData, onClick: () -> Unit) {
    ElevatedCard(
        onClick = onClick,
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.elevatedCardColors(containerColor = CanisterrSurface),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 0.dp),
        modifier = Modifier.width(168.dp),
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            PosterPlaceholder(movie = movie, height = 210.dp)
            Text(movie.title, maxLines = 1, overflow = TextOverflow.Ellipsis, color = CanisterrText)
            Text("${movie.year} • ${movie.genre}", color = CanisterrTextSoft, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun PosterPlaceholder(movie: MovieCardData, height: androidx.compose.ui.unit.Dp) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(22.dp))
            .background(
                Brush.linearGradient(
                    listOf(movie.posterTone, movie.accent.copy(alpha = 0.9f)),
                )
            )
            .border(1.dp, CanisterrBorder, RoundedCornerShape(22.dp)),
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AssistChip(
                    onClick = {},
                    label = { Text(movie.rating) },
                    colors = AssistChipDefaults.assistChipColors(containerColor = Color.Black.copy(alpha = 0.3f)),
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = movie.title,
                    style = MaterialTheme.typography.titleLarge,
                    color = Color.White,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(movie.year, color = Color.White.copy(alpha = 0.8f))
            }
        }
    }
}

@Composable
private fun FriendActivityCard(activity: FriendActivityData) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CanisterrSurface),
        shape = RoundedCornerShape(22.dp),
        modifier = Modifier.width(160.dp),
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Brush.linearGradient(listOf(activity.accent, activity.accent.copy(alpha = 0.45f)))),
            )
            Text(activity.movieTitle, color = CanisterrText, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("by ${activity.friendName}", color = CanisterrTextSoft, style = MaterialTheme.typography.bodySmall)
            Text(activity.verdict, color = CanisterrPrimarySoft, style = MaterialTheme.typography.labelLarge)
            Text(activity.timeAgo, color = CanisterrTextSoft, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun LogCard(entry: LogEntryData) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CanisterrSurface),
        shape = RoundedCornerShape(22.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(
                modifier = Modifier
                    .size(76.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Brush.linearGradient(listOf(entry.posterTone, entry.posterTone.copy(alpha = 0.5f)))),
            )
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(entry.friendName, color = CanisterrText, style = MaterialTheme.typography.titleMedium)
                    Text(entry.timeAgo, color = CanisterrTextSoft, style = MaterialTheme.typography.bodySmall)
                }
                Text(entry.movieTitle, color = CanisterrPrimarySoft)
                Text(entry.note, color = CanisterrTextSoft, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, style = MaterialTheme.typography.titleLarge, color = CanisterrText)
        Text(subtitle, color = CanisterrTextSoft)
    }
}

@Composable
private fun ActionRow() {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        ActionButton(label = "Add to List", icon = Icons.Outlined.BookmarkBorder, modifier = Modifier.weight(1f))
        ActionButton(label = "Share", icon = Icons.Outlined.Share, modifier = Modifier.weight(1f))
        ActionButton(label = "Log Movie", icon = Icons.Outlined.Add, modifier = Modifier.weight(1f), highlighted = true)
    }
}

@Composable
private fun ActionButton(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
    highlighted: Boolean = false,
) {
    val background = if (highlighted) CanisterrPrimary else CanisterrSurface
    val contentColor = if (highlighted) Color.Black else CanisterrText

    Card(
        colors = CardDefaults.cardColors(containerColor = background),
        shape = RoundedCornerShape(20.dp),
        modifier = modifier.height(52.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icon, contentDescription = label, tint = contentColor)
            Spacer(modifier = Modifier.width(8.dp))
            Text(label, color = contentColor, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun RatingSection(movie: MovieCardData) {
    val total = movie.ratingBuckets.sumOf { it.count }.coerceAtLeast(1)
    val verdict = movie.ratingBuckets.maxByOrNull { it.count }?.label ?: "Unrated"

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("RATING DISTRIBUTION", color = CanisterrTextSoft)
            Text("${movie.logCount} LOGS", color = CanisterrTextSoft)
        }

        Row(modifier = Modifier.fillMaxWidth().height(16.dp), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            movie.ratingBuckets.forEach { bucket ->
                Box(
                    modifier = Modifier
                        .weight(bucket.count.toFloat().coerceAtLeast(0.1f))
                        .fillMaxSize()
                        .clip(RoundedCornerShape(999.dp))
                        .background(bucket.color)
                )
            }
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "VERDICT",
                style = MaterialTheme.typography.labelLarge,
                color = CanisterrTextSoft,
            )
            Text(
                text = verdict.uppercase(),
                style = MaterialTheme.typography.headlineMedium,
                color = CanisterrPrimarySoft,
            )
            Spacer(modifier = Modifier.height(2.dp))
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                movie.ratingBuckets.forEach { bucket ->
                    RatingPill(bucket = bucket)
                }
            }
        }
    }
}

@Composable
private fun RatingPill(bucket: RatingBucket) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier
            .border(1.dp, CanisterrBorder, RoundedCornerShape(18.dp))
            .padding(horizontal = 16.dp, vertical = 10.dp),
    ) {
        Box(
            modifier = Modifier
                .size(14.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(bucket.color),
        )
        Text("${bucket.label} ${bucket.count}", color = CanisterrText)
    }
}

@Composable
private fun MyReviewCard(review: String) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CanisterrSurface),
        shape = RoundedCornerShape(22.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("My Review", style = MaterialTheme.typography.titleLarge, color = CanisterrText)
            Text(review, color = CanisterrTextSoft)
        }
    }
}

@Composable
private fun StatsRow(movie: MovieCardData) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        StatCard("Total Reviews", movie.reviewCount.toString(), Modifier.weight(1f))
        StatCard("Total Logs", movie.logCount.toString(), Modifier.weight(1f))
        StatCard("Total Watched", movie.watchedCount.toString(), Modifier.weight(1f))
    }
}

@Composable
private fun StatCard(title: String, value: String, modifier: Modifier = Modifier) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CanisterrSurface),
        shape = RoundedCornerShape(18.dp),
        modifier = modifier,
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, color = CanisterrTextSoft, style = MaterialTheme.typography.bodySmall)
            Text(value, color = CanisterrText, style = MaterialTheme.typography.titleLarge)
        }
    }
}

@Composable
private fun FriendsWhoWatchedIt(movie: MovieCardData, onMovieSelected: (Int) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Friends who watched it", style = MaterialTheme.typography.titleLarge, color = CanisterrText)
        LazyVerticalGrid(
            columns = GridCells.Adaptive(88.dp),
            modifier = Modifier.height(320.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            userScrollEnabled = false,
        ) {
            items(movie.friendWatchers.take(10)) { name ->
                FriendWatcherBox(name = name)
            }
        }
        TextButton(onClick = { onMovieSelected(movie.id) }) {
            Icon(Icons.Outlined.PlayArrow, contentDescription = null, tint = CanisterrPrimarySoft)
            Spacer(modifier = Modifier.width(6.dp))
            Text("Open movie logs", color = CanisterrPrimarySoft)
        }
    }
}

@Composable
private fun FriendWatcherBox(name: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(22.dp))
                .background(CanisterrSurfaceAlt)
                .border(1.dp, CanisterrBorder, RoundedCornerShape(22.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = name.first().uppercase(),
                color = CanisterrText,
                style = MaterialTheme.typography.titleLarge,
            )
        }
        Text(name, color = CanisterrTextSoft, style = MaterialTheme.typography.bodySmall, maxLines = 1)
    }
}

@Composable
private fun PosterHero(movie: MovieCardData) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(420.dp)
            .clip(RoundedCornerShape(30.dp))
            .background(Brush.linearGradient(listOf(movie.posterTone, movie.accent))),
        contentAlignment = Alignment.BottomStart,
    ) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                movie.rating,
                color = Color.Black,
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier
                    .background(CanisterrPrimary, RoundedCornerShape(999.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            )
            Text(
                movie.title,
                style = MaterialTheme.typography.displayLarge,
                color = Color.White,
            )
        }
    }
}
