package com.shiptos.captain

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED &&
            intent?.action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) {
            return
        }

        val prefs = context.getSharedPreferences("rider_tracking_prefs", Context.MODE_PRIVATE)
        val riderId = prefs.getString("key_rider_id", null)
        val apiBaseUrl = prefs.getString("key_api_base_url", "https://api.shiptos.com")

        if (riderId.isNullOrBlank()) {
            Log.e("BootCompletedReceiver", "[RIDER_BOOT] no stored rider id, skipping restart")
            return
        }

        val serviceIntent = Intent(context, LocationService::class.java).apply {
            putExtra("riderId", riderId)
            putExtra("apiBaseUrl", apiBaseUrl)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }

        Log.e("BootCompletedReceiver", "[RIDER_BOOT] restarted tracking for rider=$riderId")
    }
}
