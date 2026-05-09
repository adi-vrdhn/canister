package com.canisterr.app.data

import com.canisterr.app.model.AppContent
import com.canisterr.app.model.profileStats
import com.canisterr.app.model.sampleFriendActivity
import com.canisterr.app.model.sampleLogs
import com.canisterr.app.model.sampleMovies

class DemoAppContentRepository : AppContentRepository {
    override suspend fun loadContent(): AppContent = AppContent(
        movies = sampleMovies,
        friendActivity = sampleFriendActivity,
        logs = sampleLogs,
        profileStats = profileStats,
    )
}
