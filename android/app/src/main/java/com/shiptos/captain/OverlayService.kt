package com.shiptos.captain

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager

/**
 * Floating overlay service that shows a draggable bubble with live tracking
 * status (speed + pulsing dot). This is the fallback when PiP is not
 * available (Android < 8.0 or PiP disabled).
 *
 * Requires SYSTEM_ALERT_WINDOW permission.
 *
 * Behavior:
 * - Draggable: rider can move it anywhere on screen
 * - Tap: opens MainActivity (returns to app)
 * - Receives location broadcasts from LocationService
 */
class OverlayService : Service() {

    companion object {
        private const val TAG = "OverlayService"
        private const val OVERLAY_NOTIFICATION_ID = 12399
        private const val OVERLAY_CHANNEL_ID = "OverlayServiceChannel"

        @Volatile
        var isRunning: Boolean = false
            private set
    }

    private lateinit var windowManager: WindowManager
    private var overlayView: View? = null
    private var speedText: TextView? = null
    private var liveDot: View? = null

    private val uiHandler = Handler(Looper.getMainLooper())

    // Broadcast receiver for location updates from LocationService
    private val locationReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == PiPActivity.ACTION_LOCATION_BROADCAST) {
                val speedKmh = (intent.getFloatExtra(PiPActivity.EXTRA_SPEED, 0f) * 3.6f).toInt()
                speedText?.text = "$speedKmh"
            }
        }
    }

    // Pulse animation for the live dot
    private val pulseRunnable = object : Runnable {
        override fun run() {
            liveDot?.let {
                it.alpha = if (it.alpha > 0.7f) 0.3f else 1.0f
            }
            uiHandler.postDelayed(this, 800)
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "onCreate")
        isRunning = true
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        createNotificationChannel()
        startForeground(OVERLAY_NOTIFICATION_ID, buildNotification())
        createOverlayView()

        // Register for location broadcasts
        LocalBroadcastManager.getInstance(this)
            .registerReceiver(locationReceiver, IntentFilter(PiPActivity.ACTION_LOCATION_BROADCAST))

        // Start pulse animation
        uiHandler.post(pulseRunnable)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                OVERLAY_CHANNEL_ID,
                "Tracking Overlay",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                setShowBadge(false)
                enableVibration(false)
                setSound(null, null)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification() = NotificationCompat.Builder(this, OVERLAY_CHANNEL_ID)
        .setContentTitle("📍 Tracking Overlay Active")
        .setContentText("Tap to return to the app")
        .setSmallIcon(android.R.drawable.ic_menu_mylocation)
        .setOngoing(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .setContentIntent(
            PendingIntent.getActivity(
                this, 0,
                Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        )
        .build()

    private fun createOverlayView() {
        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            dp(72),
            dp(72),
            layoutType,
            // FLAG_NOT_FOCUSABLE: overlay doesn't capture key events
            // FLAG_SHOW_WHEN_LOCKED: visible above the keyguard (lock screen)
            // FLAG_KEEP_SCREEN_ON: prevents screen from dimming while overlay is visible
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.END
            x = dp(16)
            y = dp(100)
        }

        // Build the overlay view programmatically
        val container = FrameLayout(this)

        // Background circle
        val bg = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.parseColor("#1A1A2E"))
            setStroke(dp(2), Color.parseColor("#10B981"))
        }
        container.background = bg
        container.elevation = dp(8).toFloat()

        // Inner layout
        val innerLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
        }

        // Live dot
        liveDot = View(this).apply {
            val dotSize = dp(6)
            layoutParams = LinearLayout.LayoutParams(dotSize, dotSize).apply {
                gravity = Gravity.CENTER_HORIZONTAL
                bottomMargin = dp(2)
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#10B981"))
            }
        }

        // Speed text
        speedText = TextView(this).apply {
            text = "0"
            setTextColor(Color.WHITE)
            textSize = 16f
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
        }

        // Unit label
        val unitLabel = TextView(this).apply {
            text = "km/h"
            setTextColor(Color.parseColor("#94A3B8"))
            textSize = 7f
            gravity = Gravity.CENTER
        }

        innerLayout.addView(liveDot)
        innerLayout.addView(speedText)
        innerLayout.addView(unitLabel)

        container.addView(innerLayout, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
            Gravity.CENTER
        ))

        // Touch handling: drag + tap
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var isDragging = false

        container.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    isDragging = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - initialTouchX).toInt()
                    val dy = (event.rawY - initialTouchY).toInt()

                    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                        isDragging = true
                    }

                    params.x = initialX - dx  // Inverted because gravity is END
                    params.y = initialY + dy
                    try {
                        windowManager.updateViewLayout(overlayView, params)
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to update overlay position", e)
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!isDragging) {
                        // It was a tap — return to app
                        val intent = Intent(this, MainActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        }
                        startActivity(intent)
                    }
                    true
                }
                else -> false
            }
        }

        overlayView = container

        try {
            windowManager.addView(overlayView, params)
            Log.d(TAG, "✅ Overlay view added")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to add overlay view", e)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand")
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "onDestroy")
        isRunning = false

        uiHandler.removeCallbacks(pulseRunnable)

        try {
            overlayView?.let { windowManager.removeView(it) }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to remove overlay view", e)
        }
        overlayView = null

        try {
            LocalBroadcastManager.getInstance(this)
                .unregisterReceiver(locationReceiver)
        } catch (e: Exception) {
            Log.w(TAG, "Error unregistering receiver", e)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun dp(value: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics
        ).toInt()
    }
}
