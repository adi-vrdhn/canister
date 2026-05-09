package com.canisterr.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.canisterr.app.ui.screens.CanisterrApp
import com.canisterr.app.ui.theme.CanisterrTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CanisterrTheme {
                CanisterrApp()
            }
        }
    }
}
