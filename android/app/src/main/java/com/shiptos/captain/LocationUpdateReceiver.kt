package com.shiptos.captain

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.LocationResult

/**
 * BroadcastReceiver that receives location updates delivered via PendingIntent.
 *
 * Why this exists:
 * ─────────────────────────────────────────────────────────────────────────────
 * When the phone screen is locked, Android enters "Doze mode" which kills
 * callback-based location requests (LocationCallback). This is why location
 * sharing stops after the screen locks.
 *
 * The FusedLocationProvider supports a second delivery mechanism: a PendingIntent
 * that the SYSTEM delivers directly, bypassing Doze restrictions. This is the
 * exact approach Google Maps uses to keep navigation running when locked.
 *
 * Flow:
 *   FusedLocationProvider (system)
 *       │  [bypasses Doze — system-level delivery]
 *       ▼
 *   LocationUpdateReceiver.onReceive()
 *       │
 *       ├── LocationService.instance?.onBackgroundLocationReceived()  [if alive]
 *       └── Restart LocationService via Intent                        [if killed]
 */
class LocationUpdateReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "LocationUpdateReceiver"
        const val ACTION_LOCATION_UPDATE = "com.shiptos.captain.LOCATION_UPDATE"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_LOCATION_UPDATE) return

        val locationResult = LocationResult.extractResult(intent)
        val location = locationResult?.lastLocation

        if (location == null) {
            Log.w(TAG, "⚠️ Received location broadcast but location was null")
            return
        }

        Log.d(TAG, "📍 Background location received: lat=${location.latitude}, lng=${location.longitude}, speed=${location.speed}")

        // ── CRITICAL: Hold a temporary WakeLock ──
        // When the system delivers this broadcast in Doze mode, it only keeps the CPU awake
        // for the duration of onReceive(). Since our network calls are asynchronous (OkHttp enqueue),
        // we must acquire our own WakeLock for a few seconds to ensure the requests complete
        // before the CPU suspends again.
        try {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            val wakeLock = powerManager.newWakeLock(
                android.os.PowerManager.PARTIAL_WAKE_LOCK,
                "com.shiptos.captain:LocationReceiverWakeLock"
            )
            wakeLock.acquire(10_000L) // Hold for max 10 seconds
            Log.d(TAG, "✅ Acquired temporary 10s WakeLock for network transmission")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to acquire temporary WakeLock", e)
        }

        val service = LocationService.instance
        if (service != null && LocationService.isRunning) {
            // Service is alive — delegate directly (fastest path)
            service.onBackgroundLocationReceived(location)
        } else {
            // Service was killed by OS — restart it, let it resume from prefs
            Log.w(TAG, "⚠️ LocationService not running, restarting from location broadcast")
            try {
                val prefs = context.getSharedPreferences("rider_tracking_prefs", Context.MODE_PRIVATE)
                val riderId = prefs.getString("key_rider_id", null)
                val apiBaseUrl = prefs.getString("key_api_base_url", null)
                val userStopped = prefs.getBoolean("key_user_requested_stop", false)

                if (!userStopped && riderId != null) {
                    val serviceIntent = Intent(context, LocationService::class.java).apply {
                        putExtra("riderId", riderId)
                        putExtra("apiBaseUrl", apiBaseUrl ?: "https://api.shiptos.com")
                    }
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent)
                    } else {
                        context.startService(serviceIntent)
                    }
                    Log.d(TAG, "✅ LocationService restart triggered from background receiver")
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to restart LocationService", e)
            }
        }
    }
}
