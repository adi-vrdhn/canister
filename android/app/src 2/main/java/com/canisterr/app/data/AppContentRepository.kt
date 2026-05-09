package com.canisterr.app.data

import com.canisterr.app.model.AppContent

interface AppContentRepository {
    suspend fun loadContent(): AppContent
}
