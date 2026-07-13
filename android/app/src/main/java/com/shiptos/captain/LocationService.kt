package com.shiptos.captain

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.AlarmManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.location.Location
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.BatteryManager
import android.os.IBinder
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import android.widget.Toast
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import android.net.wifi.WifiManager
import androidx.localbroadcastmanager.content.LocalBroadcastManager

class LocationService : Service() {

    companion object {
        private const val TAG = "LocationService"
        private const val HEARTBEAT_INTERVAL_MS = 5000L
        private const val NOTIFICATION_REFRESH_MS = 15000L
        private const val PREFS_NAME = "rider_tracking_prefs"
        private const val KEY_RIDER_ID = "key_rider_id"
        private const val KEY_API_BASE_URL = "key_api_base_url"
        private const val KEY_USER_REQUESTED_STOP = "key_user_requested_stop"
        private const val RESTART_REQUEST_CODE = 9001
        private const val SELF_HEAL_REQUEST_CODE = 9002
        private const val SELF_HEAL_INTERVAL_MS = 60_000L // check every 60s
        const val CHANNEL_ID = "TrackingChannel"
        const val NOTIFICATION_ID = 12345
        const val ACTION_STOP_TRACKING = "ACTION_STOP_TRACKING"
        const val ACTION_SELF_HEAL = "ACTION_SELF_HEAL"
        private const val LOCATION_PENDING_INTENT_CODE = 9010

        /** Track whether the service is running (checked by RiderTrackingModule.isServiceRunning) */
        @Volatile
        var isRunning: Boolean = false
            private set

        /**
         * Set to true when JS requests PiP. MainActivity.onUserLeaveHint() reads this
         * flag and launches PiPActivity while still in foreground — the only context
         * allowed to startActivity on Android 10+ release builds.
         */
        @Volatile
        var pipRequested: Boolean = false

        var instance: LocationService? = null
            private set
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()
    private val heartbeatHandler = Handler(Looper.getMainLooper())
    private val notificationHandler = Handler(Looper.getMainLooper())
    private val prefs: SharedPreferences by lazy {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    /**
     * PendingIntent-based location updates — delivered by the SYSTEM even in Doze mode
     * and when the screen is locked. This is the Google Maps approach.
     */
    private var locationPendingIntent: PendingIntent? = null

    private var riderId: String? = null
    private var apiBaseUrl: String = "https://api.shiptos.com"
    private var heartbeatActive = false
    private var notificationRefreshActive = false

    /**
     * Native Socket.IO client — maintains a direct WebSocket to the backend even when
     * the React Native JS thread is suspended (background/PiP). This is the primary
     * path for real-time admin panel updates in background mode.
     */
    private var nativeSocket: NativeSocketClient? = null

    /** Dynamic taskTracking extras — updated from JS via updateTrackingExtras() */
    @Volatile
    private var taskTrackingExtras: String? = null

    /** Last known location for notification display + self-heal restoration */
    @Volatile
    private var lastLocation: Location? = null

    /** Connectivity manager for offline detection */
    private lateinit var connectivityManager: ConnectivityManager

    private val gpsReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == LocationManager.PROVIDERS_CHANGED_ACTION) {
                val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
                val isGpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)

                if (!isGpsEnabled) {
                    Log.e(TAG, "⚠️ GPS is disabled!")
                    Toast.makeText(context, "GPS MUST BE ON during an active trip!", Toast.LENGTH_LONG).show()
                    val settingsIntent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                    settingsIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    context.startActivity(settingsIntent)
                } else {
                    Log.e(TAG, "✅ GPS is enabled")
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.e(TAG, "🔄 LocationService onCreate")
        instance = this
        isRunning = true
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        acquireWakeLock()
        acquireWifiLock()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    lastLocation = location
                    Log.e(TAG, "📍 Location received: lat=${location.latitude}, lng=${location.longitude}, speed=${location.speed}, accuracy=${location.accuracy}")

                    Log.e(
                        TAG,
                        "[RIDER_NATIVE_LOCATION] ${System.currentTimeMillis()} rider=$riderId lat=${location.latitude} lng=${location.longitude} speedKmh=${location.speed * 3.6f} bearing=${location.bearing} accuracy=${location.accuracy}"
                    )

                    // Emit to React Native via RiderTrackingModule
                    RiderTrackingModule.instance?.sendLocationEvent(location)

                    // ── Primary path: native socket → backend socket.on("riderLocationUpdate")
                    //    → socketService.emitToAdmin() → admin panel updates in real-time
                    //    Works even when the React Native JS socket is suspended.
                    emitLocationViaNativeSocket(location)

                    // ── Backup path: HTTP POST → backend /api/v1/location/update
                    //    → io.to("admin-dashboard").emit() → admin panel
                    sendLocationToBackend(location)

                    // Broadcast to PiPActivity and OverlayService
                    broadcastLocation(location)
                } ?: run {
                    Log.w(TAG, "⚠️ onLocationResult called with no lastLocation")
                }
            }
        }

        registerReceiver(gpsReceiver, IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION))
        Log.e(TAG, "✅ GPS receiver registered")
    }

    /**
     * Called from JS via RiderTrackingModule.updateTrackingExtras().
     * Updates the taskTracking JSON string that gets included in HTTP POSTs.
     */
    fun updateExtras(extras: String?) {
        taskTrackingExtras = if (extras.isNullOrEmpty()) null else extras
        Log.e(TAG, "📦 taskTrackingExtras updated: ${taskTrackingExtras?.take(100)}")
    }

    /**
     * Broadcast location to PiPActivity and OverlayService via LocalBroadcastManager.
     * This keeps the mini-window speed display updated without IPC overhead.
     */
    private fun broadcastLocation(location: Location) {
        val intent = Intent(PiPActivity.ACTION_LOCATION_BROADCAST).apply {
            putExtra(PiPActivity.EXTRA_LAT, location.latitude)
            putExtra(PiPActivity.EXTRA_LNG, location.longitude)
            putExtra(PiPActivity.EXTRA_SPEED, location.speed)
            putExtra(PiPActivity.EXTRA_BEARING, location.bearing)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    /**
     * Emit a "riderLocationUpdate" Socket.IO event directly via the native WebSocket client.
     *
     * This is the PRIMARY path for real-time admin panel updates when the app is in
     * background / PiP mode (React Native JS thread is throttled / suspended).
     *
     * The backend's socket.on("riderLocationUpdate") handler receives this and calls
     * socketService.emitToAdmin("riderLocationUpdate", ...) — the same path used in
     * foreground mode. The admin panel receives live updates with zero extra setup.
     */
    private fun emitLocationViaNativeSocket(location: Location) {
        val socket = nativeSocket ?: return
        if (riderId == null) return

        try {
            val locationObj = JSONObject().apply {
                put("lat", location.latitude)
                put("lng", location.longitude)
            }

            val payload = JSONObject().apply {
                put("riderId", riderId)
                put("location", locationObj)
                put("lat", location.latitude)
                put("lng", location.longitude)
                put("speed", location.speed * 3.6f)
                put("bearing", location.bearing)
                put("batteryLevel", getBatteryLevel())
                put("status", "active")
            }

            // Attach taskTracking if available
            if (!taskTrackingExtras.isNullOrEmpty()) {
                try {
                    payload.put("taskTracking", JSONObject(taskTrackingExtras))
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to attach taskTracking to socket payload", e)
                }
            }

            val sent = socket.emit("riderLocationUpdate", payload)
            if (sent) {
                Log.d(TAG, "📡 [NATIVE_SOCKET] emitted riderLocationUpdate for rider=$riderId")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ emitLocationViaNativeSocket failed", e)
        }
    }

    /**
     * Start PiPActivity for picture-in-picture mode.
     * Called from JS via RiderTrackingModule.startPiP().
     */
    fun startPiP() {
        // Set the flag — MainActivity.onUserLeaveHint() will read it and launch
        // PiPActivity while still in the foreground. This is the only safe approach
        // on Android 10+ release builds where startActivity() from a Service/Module
        // context is blocked.
        pipRequested = true
        Log.d(TAG, "📌 PiP requested — will launch from MainActivity.onUserLeaveHint()")
    }

    /**
     * Stop PiPActivity if it's currently running.
     * Called from JS via RiderTrackingModule.stopPiP().
     */
    fun stopPiP() {
        try {
            PiPActivity.instance?.finish()
            Log.d(TAG, "✅ PiPActivity finished")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to stop PiPActivity", e)
        }
    }

    /**
     * Start the floating overlay service.
     * Called from JS via RiderTrackingModule.startOverlay().
     */
    fun startOverlay() {
        try {
            val intent = Intent(this, OverlayService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
            Log.d(TAG, "✅ OverlayService started")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to start OverlayService", e)
        }
    }

    /**
     * Stop the floating overlay service.
     * Called from JS via RiderTrackingModule.stopOverlay().
     */
    fun stopOverlay() {
        try {
            stopService(Intent(this, OverlayService::class.java))
            Log.d(TAG, "✅ OverlayService stopped")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to stop OverlayService", e)
        }
    }

    private fun isNetworkAvailable(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork ?: return false
            val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
            return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            @Suppress("DEPRECATION")
            val networkInfo = connectivityManager.activeNetworkInfo ?: return false
            @Suppress("DEPRECATION")
            return networkInfo.isConnected
        }
    }

    private fun sendLocationToBackend(location: Location) {
        if (riderId == null) {
            Log.e(TAG, "❌ No riderId set, skipping upload.")
            return
        }

        // Skip if no network — avoid wasting battery on failed requests
        if (!isNetworkAvailable()) {
            Log.e(TAG, "📡 No network, skipping HTTP POST")
            return
        }

        val url = "${apiBaseUrl.trimEnd('/')}/api/v1/location/update"
        val timestamp = System.currentTimeMillis()

        val json = JSONObject()
        json.put("riderId", riderId)
        json.put("lat", location.latitude)
        json.put("lng", location.longitude)
        json.put("speed", location.speed * 3.6f)
        json.put("bearing", location.bearing)
        json.put("batteryLevel", getBatteryLevel())
        json.put("status", "active")

        // Attach taskTracking if available (set by JS via updateTrackingExtras)
        if (!taskTrackingExtras.isNullOrEmpty()) {
            try {
                json.put("taskTracking", JSONObject(taskTrackingExtras))
            } catch (e: Exception) {
                Log.e(TAG, "⚠️ Failed to parse taskTracking JSON, sending without it", e)
            }
        }

        Log.e(
            TAG,
            "[RIDER_NATIVE_HTTP] $timestamp rider=$riderId url=$url lat=${location.latitude} lng=${location.longitude}"
        )

        val requestBody = json.toString().toRequestBody("application/json; charset=utf-8".toMediaType())

        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .build()

        // Fire and forget with retry
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "[RIDER_NATIVE_HTTP_FAIL] $timestamp rider=$riderId error=${e.message}")
                // Retry once after a short delay
                Handler(Looper.getMainLooper()).postDelayed({
                    if (isNetworkAvailable() && isRunning) {
                        Log.e(TAG, "[RIDER_NATIVE_HTTP_RETRY] rider=$riderId retrying failed request")
                        client.newCall(request).enqueue(object : Callback {
                            override fun onFailure(retryCall: Call, retryE: IOException) {
                                Log.e(TAG, "[RIDER_NATIVE_HTTP_RETRY_FAIL] rider=$riderId error=${retryE.message}")
                            }
                            override fun onResponse(retryCall: Call, response: Response) {
                                Log.e(TAG, "[RIDER_NATIVE_HTTP_RETRY_OK] rider=$riderId status=${response.code}")
                                response.close()
                            }
                        })
                    }
                }, 3000L) // 3s retry delay
            }

            override fun onResponse(call: Call, response: Response) {
                Log.e(TAG, "[RIDER_NATIVE_HTTP_OK] $timestamp rider=$riderId status=${response.code}")
                response.close()
            }
        })
    }

    private fun startHeartbeat() {
        if (heartbeatActive) return
        heartbeatActive = true

        val heartbeatRunnable = object : Runnable {
            override fun run() {
                if (!heartbeatActive) return

                Log.e(
                    TAG,
                    "[RIDER_HEARTBEAT] ${System.currentTimeMillis()} rider=$riderId service=alive tracking=on lastLoc=$lastLocation"
                )

                heartbeatHandler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
            }
        }

        heartbeatHandler.post(heartbeatRunnable)
    }

    private fun stopHeartbeat() {
        heartbeatActive = false
        heartbeatHandler.removeCallbacksAndMessages(null)
    }

    /**
     * Google Maps style: refresh the notification every 15s.
     * This keeps the notification "fresh" so OEMs (Xiaomi, Samsung) don't
     * consider it stale and kill the service.
     */
    private fun startNotificationRefresh() {
        if (notificationRefreshActive) return
        notificationRefreshActive = true

        val refreshRunnable = object : Runnable {
            override fun run() {
                if (!notificationRefreshActive) return
                updateNotification()
                notificationHandler.postDelayed(this, NOTIFICATION_REFRESH_MS)
            }
        }
        notificationHandler.post(refreshRunnable)
    }

    private fun stopNotificationRefresh() {
        notificationRefreshActive = false
        notificationHandler.removeCallbacksAndMessages(null)
    }

    /**
     * Update the foreground notification with current location + time.
     * Keeps it feeling "live" like Google Maps navigation.
     */
    private fun updateNotification() {
        try {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val appIntent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
            val pendingAppIntent = PendingIntent.getActivity(
                this, 0, appIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val stopIntent = Intent(this, LocationService::class.java).apply {
                action = ACTION_STOP_TRACKING
            }
            val pendingStopIntent = PendingIntent.getService(
                this, 1, stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val timeStr = SimpleDateFormat("hh:mm:ss a", Locale.getDefault()).format(Date())
            val speedKmh = ((lastLocation?.speed ?: 0f) * 3.6f).toInt()

            val body = if (lastLocation != null) {
                "Live • ${speedKmh} km/h • Updated $timeStr"
            } else {
                "Live • Waiting for GPS... • $timeStr"
            }

            val notification = NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("📍 Live Tracking Active")
                .setContentText(body)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(pendingAppIntent)
                .setOnlyAlertOnce(true)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop Sharing", pendingStopIntent)
                .build()

            notificationManager.notify(NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            Log.e(TAG, "⚠️ Failed to update notification", e)
        }
    }

    private fun persistTrackingConfig() {
        prefs.edit()
            .putString(KEY_RIDER_ID, riderId)
            .putString(KEY_API_BASE_URL, apiBaseUrl)
            .apply()
    }

    /**
     * Schedule a RECURRING self-heal alarm. Every 60s this fires an intent
     * that restarts the service if it has been killed by the OEM.
     * This is the key mechanism that keeps tracking alive on Xiaomi/Redmi.
     */
    private fun scheduleSelfHealAlarm() {
        val healIntent = Intent(applicationContext, LocationService::class.java).apply {
            action = ACTION_SELF_HEAL
            putExtra("riderId", riderId ?: prefs.getString(KEY_RIDER_ID, null))
            putExtra("apiBaseUrl", apiBaseUrl.ifBlank { prefs.getString(KEY_API_BASE_URL, "https://api.shiptos.com") ?: "https://api.shiptos.com" })
        }

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pendingIntent = PendingIntent.getService(
            applicationContext,
            SELF_HEAL_REQUEST_CODE,
            healIntent,
            flags
        )

        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager

        // Use setExactAndAllowWhileIdle for reliability in Doze mode
        val triggerAt = System.currentTimeMillis() + SELF_HEAL_INTERVAL_MS
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
            // Also set an inexact repeating alarm as backup (survives reboots better)
            alarmManager.setInexactRepeating(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + SELF_HEAL_INTERVAL_MS,
                SELF_HEAL_INTERVAL_MS,
                pendingIntent
            )
        } else {
            alarmManager.setRepeating(
                AlarmManager.RTC_WAKEUP,
                triggerAt,
                SELF_HEAL_INTERVAL_MS,
                pendingIntent
            )
        }

        Log.e(TAG, "[RIDER_SELF_HEAL] scheduled recurring restart alarm every ${SELF_HEAL_INTERVAL_MS}ms")
    }

    private fun cancelSelfHealAlarm() {
        val healIntent = Intent(applicationContext, LocationService::class.java).apply {
            action = ACTION_SELF_HEAL
        }
        val flags = PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        val pendingIntent = PendingIntent.getService(
            applicationContext,
            SELF_HEAL_REQUEST_CODE,
            healIntent,
            flags
        )
        if (pendingIntent != null) {
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.cancel(pendingIntent)
            Log.e(TAG, "[RIDER_SELF_HEAL] cancelled recurring alarm")
        }
    }

    /**
     * Schedule a one-shot restart on task removal (swipe kill).
     * Now uses 3 staggered attempts for reliability.
     */
    private fun scheduleServiceRestart() {
        val restartIntent = Intent(applicationContext, LocationService::class.java).apply {
            putExtra("riderId", riderId ?: prefs.getString(KEY_RIDER_ID, null))
            putExtra("apiBaseUrl", apiBaseUrl.ifBlank { prefs.getString(KEY_API_BASE_URL, "https://api.shiptos.com") ?: "https://api.shiptos.com" })
        }

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pendingIntent = PendingIntent.getService(
            applicationContext,
            RESTART_REQUEST_CODE,
            restartIntent,
            flags
        )

        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager

        // Schedule 3 restart attempts: 1s, 15s, 60s
        val delays = listOf(1000L, 15000L, 60000L)
        for (delay in delays) {
            val triggerAt = System.currentTimeMillis() + delay
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
            }
        }

        Log.e(TAG, "[RIDER_SERVICE_RESTART] ${System.currentTimeMillis()} scheduled restart at 1s, 15s, 60s")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.e(TAG, "🚀 onStartCommand, action: ${intent?.action}, flags: $flags, startId: $startId")

        // ── Handle explicit stop action ──
        if (intent?.action == ACTION_STOP_TRACKING) {
            // Only honor stop if user explicitly requested it from the app
            val userRequested = prefs.getBoolean(KEY_USER_REQUESTED_STOP, false)
            if (userRequested) {
                Log.e(TAG, "🛑 User requested stop, stopping service")
                prefs.edit().remove(KEY_USER_REQUESTED_STOP).apply()
                cancelSelfHealAlarm()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            } else {
                Toast.makeText(this, "Location sharing cannot be stopped during an active trip!", Toast.LENGTH_LONG).show()
                Log.w(TAG, "⚠️ Stop action from notification ignored – stop from app instead")
                return START_STICKY
            }
        }

        // ── Self-heal action: service was already running, just re-assert foreground ──
        if (intent?.action == ACTION_SELF_HEAL) {
            Log.e(TAG, "🔄 [SELF_HEAL] re-asserting foreground state")
            // Re-read params if needed
            intent.getStringExtra("riderId")?.let { this.riderId = it }
            intent.getStringExtra("apiBaseUrl")?.takeIf { it.isNotBlank() }?.let { this.apiBaseUrl = it }

            // Re-assert foreground + restart location updates if needed
            createNotificationChannel()
            showForegroundNotification()
            startLocationUpdates()
            startHeartbeat()
            startNotificationRefresh()
            scheduleSelfHealAlarm() // re-schedule next heal

            // Re-connect native socket if it dropped
            if (nativeSocket?.isConnected?.get() != true) {
                nativeSocket?.connect() ?: run {
                    nativeSocket = NativeSocketClient(
                        serverUrl = apiBaseUrl,
                        onConnected = { Log.d(TAG, "🟢 Native socket reconnected (self-heal)") },
                        onDisconnected = { Log.d(TAG, "🔴 Native socket disconnected (self-heal)") }
                    ).also { it.connect() }
                }
            }

            return START_STICKY
        }

        // ── Normal start ──
        intent?.getStringExtra("riderId")?.let {
            this.riderId = it
            Log.e(TAG, "✅ Rider ID set: $riderId")
        } ?: run {
            this.riderId = prefs.getString(KEY_RIDER_ID, null)
            Log.w(TAG, "⚠️ No riderId provided in intent, restored from prefs: $riderId")
        }

        intent?.getStringExtra("apiBaseUrl")?.takeIf { it.isNotBlank() }?.let {
            this.apiBaseUrl = it
            Log.e(TAG, "API base URL set: $apiBaseUrl")
        } ?: run {
            this.apiBaseUrl = prefs.getString(KEY_API_BASE_URL, apiBaseUrl) ?: apiBaseUrl
        }

        persistTrackingConfig()

        createNotificationChannel()
        showForegroundNotification()
        acquireWakeLock()

        startLocationUpdates()
        startHeartbeat()
        startNotificationRefresh()
        scheduleSelfHealAlarm()

        // ── Connect native socket for real-time admin panel updates in background ──
        if (nativeSocket == null) {
            nativeSocket = NativeSocketClient(
                serverUrl = apiBaseUrl,
                onConnected = { Log.d(TAG, "🟢 Native socket connected to backend") },
                onDisconnected = { Log.d(TAG, "🔴 Native socket disconnected") }
            )
        }
        nativeSocket?.connect()

        // Tell MainActivity to enable PiP auto-enter (Android 12+) now that
        // tracking is live. On Android 8–11 this is a no-op (manual trigger in onUserLeaveHint).
        try {
            MainActivity.instance?.runOnUiThread {
                MainActivity.instance?.updatePiPParams(trackingActive = true)
            }
        } catch (e: Exception) {
            Log.w(TAG, "⚠️ Could not update PiP params on start", e)
        }

        Log.e(TAG, "✅ Location updates requested + self-heal alarm scheduled + native socket connecting")
        return START_STICKY
    }

    private fun showForegroundNotification() {
        val appIntent = Intent(this, MainActivity::class.java).apply {
            this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingAppIntent = PendingIntent.getActivity(
            this, 0, appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = Intent(this, LocationService::class.java).apply {
            action = ACTION_STOP_TRACKING
        }
        val pendingStopIntent = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Full-screen intent: Android shows this as a prominent heads-up notification
        // on the lock screen (like an incoming call notification). Tapping it opens
        // the app directly from the locked state.
        val fullScreenIntent = PendingIntent.getActivity(
            this, 2, appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val timeStr = SimpleDateFormat("hh:mm:ss a", Locale.getDefault()).format(Date())
        val speedKmh = ((lastLocation?.speed ?: 0f) * 3.6f).toInt()
        val body = if (lastLocation != null) {
            "Live • ${speedKmh} km/h • Updated $timeStr"
        } else {
            "Live • Waiting for GPS... • $timeStr"
        }

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("📍 Live Tracking Active")
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            // VISIBILITY_PUBLIC: show full notification content on lock screen
            // (like Google Maps — no "Contents hidden" placeholder)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(pendingAppIntent)
            .setOnlyAlertOnce(true)
            // Full-screen intent: shows notification prominently above lock screen.
            // The second arg (highPriority=true) causes Android to display it
            // immediately like a heads-up / over-keyguard notification.
            .setFullScreenIntent(fullScreenIntent, false)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop Sharing", pendingStopIntent)
            .build()

        startForeground(NOTIFICATION_ID, notification)
        Log.e(TAG, "✅ Foreground notification shown (MAX priority)")
    }

    private fun startLocationUpdates() {
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000)
            .setWaitForAccurateLocation(false)
            .setMinUpdateIntervalMillis(2000)
            .setMaxUpdateDelayMillis(10000)
            .build()

        // ── Path 1: Callback (fast, works when app process is alive) ──────────────────
        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
            Log.e(TAG, "📡 Callback location updates started (5s interval)")
        } catch (e: SecurityException) {
            Log.e(TAG, "❌ Callback location PERMISSION DENIED", e)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Callback location start failed", e)
        }

        // ── Path 2: PendingIntent (Doze-resistant — works through lock screen) ──────
        // The SYSTEM delivers these via broadcast even in Doze mode.
        // This is the same method Google Maps uses to keep navigation running
        // when the phone is locked.
        try {
            val bgIntent = Intent(this, LocationUpdateReceiver::class.java).apply {
                action = LocationUpdateReceiver.ACTION_LOCATION_UPDATE
            }
            locationPendingIntent = PendingIntent.getBroadcast(
                this,
                LOCATION_PENDING_INTENT_CODE,
                bgIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )
            fusedLocationClient.requestLocationUpdates(locationRequest, locationPendingIntent!!)
            Log.e(TAG, "📡 PendingIntent location updates started (Doze + lock-screen resistant)")
        } catch (e: SecurityException) {
            Log.e(TAG, "❌ PendingIntent location PERMISSION DENIED", e)
        } catch (e: Exception) {
            Log.e(TAG, "❌ PendingIntent location start failed", e)
        }
    }

    /**
     * Called by LocationUpdateReceiver when the SYSTEM delivers a background location.
     * Works even in Doze mode and while the screen is locked.
     */
    fun onBackgroundLocationReceived(location: Location) {
        lastLocation = location
        Log.d(TAG, "📡 [BG_LOCATION] lat=${location.latitude}, lng=${location.longitude}, speed=${location.speed}")

        // Emit to React Native (if JS bridge is alive)
        RiderTrackingModule.instance?.sendLocationEvent(location)

        // Native socket → admin panel (primary real-time path)
        emitLocationViaNativeSocket(location)

        // HTTP POST → backend (backup path)
        sendLocationToBackend(location)

        // Broadcast to PiP + overlay for speed display
        broadcastLocation(location)
    }

    /**
     * Called from JS via RiderTrackingModule.stopTrip().
     * Sets a flag so the notification stop action is honored, then stops.
     */
    fun userRequestedStop() {
        prefs.edit().putBoolean(KEY_USER_REQUESTED_STOP, true).apply()
        // Cancel PendingIntent location updates
        locationPendingIntent?.let {
            try { fusedLocationClient.removeLocationUpdates(it) } catch (e: Exception) { }
        }
        locationPendingIntent = null
        nativeSocket?.disconnect()
        nativeSocket = null

        // Disable PiP auto-enter now that tracking is stopped
        try {
            MainActivity.instance?.runOnUiThread {
                MainActivity.instance?.updatePiPParams(trackingActive = false)
            }
        } catch (e: Exception) {
            Log.w(TAG, "⚠️ Could not update PiP params on stop", e)
        }

        // Broadcast TRACKING_STOPPED so PiPActivity finishes itself
        try {
            val stopBroadcast = Intent(PiPActivity.ACTION_TRACKING_STOPPED)
            LocalBroadcastManager.getInstance(this).sendBroadcast(stopBroadcast)
            Log.d(TAG, "📡 Sent TRACKING_STOPPED broadcast to PiP")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to send TRACKING_STOPPED broadcast", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.e(TAG, "🛑 LocationService onDestroy")
        isRunning = false
        instance = null
        stopHeartbeat()
        stopNotificationRefresh()
        releaseWakeLock()
        releaseWifiLock()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        // Cancel PendingIntent-based updates
        locationPendingIntent?.let {
            try { fusedLocationClient.removeLocationUpdates(it) } catch (e: Exception) { }
        }
        locationPendingIntent = null
        try {
            unregisterReceiver(gpsReceiver)
        } catch (e: Exception) {
            Log.e(TAG, "Error unregistering receiver", e)
        }

        // Disconnect native socket
        try {
            nativeSocket?.disconnect()
        } catch (e: Exception) {
            Log.w(TAG, "Error disconnecting native socket", e)
        } finally {
            nativeSocket = null
        }

        // If user didn't explicitly stop, reschedule self-heal so we come back
        val userRequested = prefs.getBoolean(KEY_USER_REQUESTED_STOP, false)
        if (!userRequested && riderId != null) {
            Log.e(TAG, "🔄 onDestroy: service killed by OS, scheduling restart")
            scheduleServiceRestart()
            scheduleSelfHealAlarm()
        }
        Log.e(TAG, "✅ Location service cleaned up")
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        Log.e(TAG, "[RIDER_TASK_REMOVED] ${System.currentTimeMillis()} rider=$riderId restart=scheduled")
        scheduleServiceRestart()
        scheduleSelfHealAlarm()
        super.onTaskRemoved(rootIntent)
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun getBatteryLevel(): Int {
        val batteryManager = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        return batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            .takeIf { it in 0..100 } ?: 100
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Rider Tracking",
                NotificationManager.IMPORTANCE_MAX
            ).apply {
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                setShowBadge(false)
                enableVibration(false)
                setSound(null, null)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
            Log.e(TAG, "✅ Notification channel created (IMPORTANCE_MAX)")
        }
    }

    private fun acquireWakeLock() {
        try {
            if (wakeLock?.isHeld == true) return
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "$packageName:RiderTrackingWakeLock"
            ).apply {
                setReferenceCounted(false)
                acquire(12 * 60 * 60 * 1000L) // 12 hours max timeout (safety net)
            }
            Log.e(TAG, "✅ Partial wakelock acquired (12h timeout)")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to acquire wakelock", e)
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
                Log.e(TAG, "✅ Partial wakelock released")
            }
            wakeLock = null
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to release wakelock", e)
        }
    }

    /**
     * Acquire a HIGH_PERF WiFi lock to prevent Android from turning off the
     * WiFi radio when the screen is off. Without this, WebSocket connections
     * and HTTP requests will fail with "timeout" / "websocket error" after
     * the screen locks.
     */
    private fun acquireWifiLock() {
        try {
            if (wifiLock?.isHeld == true) return
            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            wifiLock = wifiManager.createWifiLock(
                WifiManager.WIFI_MODE_FULL_HIGH_PERF,
                "$packageName:RiderTrackingWifiLock"
            ).apply {
                setReferenceCounted(false)
                acquire()
            }
            Log.e(TAG, "✅ WiFi lock acquired (HIGH_PERF)")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to acquire WiFi lock", e)
        }
    }

    private fun releaseWifiLock() {
        try {
            if (wifiLock?.isHeld == true) {
                wifiLock?.release()
                Log.e(TAG, "✅ WiFi lock released")
            }
            wifiLock = null
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to release WiFi lock", e)
        }
    }
}
