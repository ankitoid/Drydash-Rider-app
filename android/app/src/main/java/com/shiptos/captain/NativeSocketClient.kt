package com.shiptos.captain

import android.os.Handler
import android.os.Looper
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Lightweight Socket.IO / Engine.IO v4 client built on OkHttp WebSocket.
 *
 * Purpose: Keep a persistent native WebSocket connection to the backend socket server
 * even when the React Native JS thread is suspended (background/PiP mode). This ensures
 * the admin panel receives real-time rider location updates via the backend's
 * socket.on("riderLocationUpdate") handler regardless of the RN socket state.
 *
 * Engine.IO v4 packet types:
 *   "0" = open (server → client, contains sid + ping config)
 *   "2" = ping  (server → client on EIO v4)
 *   "3" = pong  (client → server)
 *   "4" = message (Socket.IO payload prefix)
 *
 * Socket.IO packet types (appended after "4"):
 *   "0" = connect  → "40"
 *   "2" = event    → "42["eventName",{...}]"
 */
class NativeSocketClient(
    private val serverUrl: String,
    private val onConnected: () -> Unit = {},
    private val onDisconnected: () -> Unit = {},
) {
    companion object {
        private const val TAG = "NativeSocketClient"

        // Engine.IO v4 packet prefixes
        private const val EIO_OPEN    = "0"
        private const val EIO_PING    = "2"
        private const val EIO_PONG    = "3"
        private const val EIO_MESSAGE = "4"

        // Socket.IO packet types (after EIO_MESSAGE prefix)
        private const val SIO_CONNECT = "0"   // full: "40"
        private const val SIO_EVENT   = "2"   // full: "42[...]"

        private const val RECONNECT_BASE_DELAY_MS = 2_000L
        private const val RECONNECT_MAX_DELAY_MS  = 10_000L
    }

    private val httpClient = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS) // required for WebSocket
        .connectTimeout(15, TimeUnit.SECONDS)
        .build()

    private val mainHandler = Handler(Looper.getMainLooper())

    @Volatile private var webSocket: WebSocket? = null

    val isConnected = AtomicBoolean(false)
    private val isShuttingDown = AtomicBoolean(false)
    private val reconnectAttempt = AtomicInteger(0)

    private var pingIntervalMs = 25_000L
    private var pingTimeoutMs  = 20_000L

    // Outbound event queue — holds events emitted before connection is established
    private val pendingEvents = ArrayDeque<Pair<String, JSONObject>>()

    // ─── Ping runnable ───────────────────────────────────────────────────────
    private val pingRunnable = object : Runnable {
        override fun run() {
            if (isConnected.get() && !isShuttingDown.get()) {
                webSocket?.send(EIO_PONG)  // Some servers expect client-pong
                mainHandler.postDelayed(this, pingIntervalMs)
            }
        }
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /** Open the WebSocket connection to the socket.io server. */
    fun connect() {
        if (isShuttingDown.get()) return
        if (isConnected.get()) return

        val wsUrl = buildWsUrl(serverUrl)
        Log.d(TAG, "🔌 Connecting to $wsUrl")

        val request = Request.Builder()
            .url(wsUrl)
            .addHeader("Origin", serverUrl)
            .build()

        webSocket = httpClient.newWebSocket(request, socketListener)
    }

    /**
     * Emit a Socket.IO event with a single JSON object payload.
     * If not yet connected, queues the event for delivery after connection.
     */
    fun emit(eventName: String, data: JSONObject): Boolean {
        val packet = buildSioEventPacket(eventName, data)

        if (!isConnected.get()) {
            Log.w(TAG, "⏳ Queuing $eventName (not connected yet)")
            synchronized(pendingEvents) {
                if (pendingEvents.size < 20) pendingEvents.addLast(eventName to data)
            }
            return false
        }

        return sendRaw(packet)
    }

    /** Gracefully close the WebSocket and stop reconnecting. */
    fun disconnect() {
        isShuttingDown.set(true)
        mainHandler.removeCallbacks(pingRunnable)
        isConnected.set(false)
        webSocket?.close(1000, "Service stopped")
        webSocket = null
        Log.d(TAG, "🔌 Disconnected")
    }

    // ─── WebSocket Listener ───────────────────────────────────────────────────

    private val socketListener = object : WebSocketListener() {

        override fun onOpen(ws: WebSocket, response: Response) {
            Log.d(TAG, "🔌 WebSocket open (HTTP ${response.code})")
            // We wait for the Engine.IO "0" open packet before sending Socket.IO connect
        }

        override fun onMessage(ws: WebSocket, text: String) {
            if (text.isEmpty()) return
            Log.d(TAG, "← $text")

            when {
                // ── Engine.IO OPEN: "0{"sid":"...","pingInterval":25000,...}" ──
                text.startsWith(EIO_OPEN) && !text.startsWith(EIO_MESSAGE) -> {
                    handleEioOpen(ws, text)
                }

                // ── Engine.IO PING from server (EIO v4 server-initiated ping) ──
                text == EIO_PING -> {
                    ws.send(EIO_PONG)
                }

                // ── Socket.IO CONNECTED: "40{"sid":"..."}" ──
                text.startsWith("${EIO_MESSAGE}${SIO_CONNECT}") -> {
                    handleSioConnected(ws)
                }

                // ── Engine.IO NOOP or other packets ──
                else -> { /* ignore */ }
            }
        }

        override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
            Log.e(TAG, "❌ WebSocket failure: ${t.message} (${response?.code})")
            handleDisconnect()
        }

        override fun onClosed(ws: WebSocket, code: Int, reason: String) {
            Log.d(TAG, "🔌 WebSocket closed: $code $reason")
            handleDisconnect()
        }
    }

    // ─── Internal handlers ────────────────────────────────────────────────────

    private fun handleEioOpen(ws: WebSocket, text: String) {
        try {
            val json = JSONObject(text.substring(EIO_OPEN.length))
            pingIntervalMs = json.optLong("pingInterval", 25_000)
            pingTimeoutMs  = json.optLong("pingTimeout",  20_000)
            Log.d(TAG, "Engine.IO open — pingInterval=$pingIntervalMs")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse EIO open packet", e)
        }

        // Send Socket.IO CONNECT to default namespace
        ws.send("${EIO_MESSAGE}${SIO_CONNECT}")
        Log.d(TAG, "→ Sent Socket.IO CONNECT")
    }

    private fun handleSioConnected(ws: WebSocket) {
        Log.d(TAG, "✅ Socket.IO connected to namespace /")
        isConnected.set(true)
        reconnectAttempt.set(0)

        // Start ping keep-alive
        mainHandler.removeCallbacks(pingRunnable)
        mainHandler.postDelayed(pingRunnable, pingIntervalMs)

        // Flush pending events
        synchronized(pendingEvents) {
            val pending = pendingEvents.toList()
            pendingEvents.clear()
            pending.forEach { (name, data) ->
                Log.d(TAG, "📤 Flushing queued event: $name")
                sendRaw(buildSioEventPacket(name, data))
            }
        }

        onConnected()
    }

    private fun handleDisconnect() {
        val wasConnected = isConnected.getAndSet(false)
        mainHandler.removeCallbacks(pingRunnable)
        webSocket = null

        if (wasConnected) onDisconnected()

        if (!isShuttingDown.get()) {
            scheduleReconnect()
        }
    }

    private fun scheduleReconnect() {
        val attempt = reconnectAttempt.incrementAndGet()
        val delay = minOf(RECONNECT_BASE_DELAY_MS * attempt, RECONNECT_MAX_DELAY_MS)
        Log.d(TAG, "⏰ Reconnecting in ${delay}ms (attempt $attempt)")
        mainHandler.postDelayed({ connect() }, delay)
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private fun sendRaw(text: String): Boolean {
        return try {
            val sent = webSocket?.send(text) == true
            if (sent) Log.d(TAG, "→ $text")
            sent
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send: ${e.message}")
            false
        }
    }

    private fun buildSioEventPacket(eventName: String, data: JSONObject): String {
        val arr = JSONArray()
        arr.put(eventName)
        arr.put(data)
        return "${EIO_MESSAGE}${SIO_EVENT}$arr"
    }

    /**
     * Convert http(s):// base URL into ws(s):// Socket.IO WebSocket endpoint.
     * e.g. "https://api.example.com" → "wss://api.example.com/socket.io/?EIO=4&transport=websocket"
     */
    private fun buildWsUrl(base: String): String {
        val trimmed = base.trimEnd('/')
        val wsBase = trimmed
            .replace("https://", "wss://")
            .replace("http://",  "ws://")
        return "$wsBase/socket.io/?EIO=4&transport=websocket"
    }
}
