package org.alavex.streaming

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.alavex.streaming.llu2.AacPlayer
import org.alavex.streaming.llu2.AvcDecoder
import org.alavex.streaming.llu2.Llu2Client
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Full-screen LLU2 session: signaling, H.264, AAC, touch and gamepad.
 */
class PlayerActivity : Activity() {
    private var socket: WebSocket? = null
    private var media: Llu2Client? = null
    private var decoder: AvcDecoder? = null
    private var audio: AacPlayer? = null
    private lateinit var statusView: TextView
    private var videoWidth = 1
    private var videoHeight = 1
    private var mediaToken: String = ""
    private val buttons = FloatArray(17)
    private val axes = FloatArray(4)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val host = intent.getStringExtra("host").orEmpty()
        val pin = intent.getStringExtra("pin").orEmpty()
        val gameId = intent.getStringExtra("gameId")

        val root = FrameLayout(this)
        val surface = SurfaceView(this)
        root.addView(surface, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
        ))
        statusView = TextView(this).apply {
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 16f
            setPadding(32, 32, 32, 32)
            text = "호스트에 연결하는 중…"
        }
        root.addView(statusView)
        val bar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        bar.addView(keyButton("Esc") { sendKey("Escape") })
        bar.addView(keyButton("종료") { finish() })
        root.addView(bar, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM or Gravity.END,
        ))
        setContentView(root)

        surface.setOnTouchListener { view, event ->
            val x = (event.x / view.width.coerceAtLeast(1)).toDouble().coerceIn(0.0, 1.0)
            val y = (event.y / view.height.coerceAtLeast(1)).toDouble().coerceIn(0.0, 1.0)
            val type = when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> "pointerdown"
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> "pointerup"
                else -> "pointermove"
            }
            sendPointer(type, x, y, "left")
            true
        }

        surface.holder.addCallback(object : SurfaceHolder.Callback {
            override fun surfaceCreated(holder: SurfaceHolder) {
                connect(host, pin, gameId, holder)
            }
            override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
                videoWidth = width
                videoHeight = height
            }
            override fun surfaceDestroyed(holder: SurfaceHolder) {
                stopMedia()
            }
        })
    }

    private fun keyButton(label: String, onClick: () -> Unit): Button {
        return Button(this).apply {
            text = label
            setOnClickListener { onClick() }
        }
    }

    private fun connect(host: String, pin: String, gameId: String?, holder: SurfaceHolder) {
        val client = OkHttpClient.Builder()
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build()
        val request = Request.Builder()
            .url("ws://$host:47989/signal?role=client")
            .build()
        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                webSocket.send(JSONObject().put("type", "auth").put("pin", pin).put("clientName", "AlaveX Android").toString())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val msg = JSONObject(text)
                when (msg.optString("type")) {
                    "auth-fail" -> show(msg.optString("reason", "PIN 오류"))
                    "auth-ok" -> {
                        mediaToken = msg.optString("mediaToken", pin)
                        show("${msg.optString("hostName", "Host")} 스트리밍 시작")
                        val quality = JSONObject()
                            .put("resolution", "1080p")
                            .put("fps", 60)
                            .put("bitrateMbps", 20)
                            .put("codec", "h264")
                            .put("hostAudio", true)
                            .put("streamStartAction", "desktop")
                            .put("latencyMode", "latency")
                        webSocket.send(JSONObject()
                            .put("type", "start-stream")
                            .put("gameId", gameId ?: "desktop")
                            .put("quality", quality)
                            .toString())
                    }
                    "stream-ready" -> {
                        val port = msg.optInt("mediaPort", 47998)
                        val token = mediaToken.ifBlank { pin }
                        runOnUiThread { startMedia(host, port, token, holder) }
                    }
                    "games" -> { /* desktop stream does not need the list */ }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                show("시그널링 실패: ${t.message}")
            }
        })
    }

    private fun startMedia(host: String, port: Int, token: String, holder: SurfaceHolder) {
        stopMedia()
        val surface = holder.surface ?: return
        val video = AvcDecoder(surface).also { it.start() }
        val sound = AacPlayer()
        decoder = video
        audio = sound
        media = Llu2Client(host, port, token, object : Llu2Client.Listener {
            override fun onVideo(frame: ByteArray, key: Boolean) = video.submit(frame, key)
            override fun onAudio(adts: ByteArray) = sound.play(adts)
            override fun onStats(rttMs: Int, lossPct: Float) {
                runOnUiThread {
                    statusView.visibility = View.GONE
                }
            }
            override fun onError(message: String) = show(message)
        }).also { it.start() }
        statusView.visibility = View.GONE
    }

    private fun sendPointer(type: String, x: Double, y: Double, button: String) {
        val event = JSONObject().put("type", type).put("x", x).put("y", y).put("button", button)
        socket?.send(JSONObject().put("type", "input").put("event", event).toString())
    }

    private fun sendKey(key: String) {
        val down = JSONObject().put("type", "keydown").put("key", key)
        val up = JSONObject().put("type", "keyup").put("key", key)
        socket?.send(JSONObject().put("type", "input").put("event", down).toString())
        socket?.send(JSONObject().put("type", "input").put("event", up).toString())
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (mapGamepad(keyCode, 1f)) return true
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        if (mapGamepad(keyCode, 0f)) return true
        return super.onKeyUp(keyCode, event)
    }

    override fun onGenericMotionEvent(event: MotionEvent): Boolean {
        if (event.source and InputDevice.SOURCE_JOYSTICK == InputDevice.SOURCE_JOYSTICK) {
            axes[0] = event.getAxisValue(MotionEvent.AXIS_X)
            axes[1] = event.getAxisValue(MotionEvent.AXIS_Y)
            axes[2] = event.getAxisValue(MotionEvent.AXIS_Z)
            axes[3] = event.getAxisValue(MotionEvent.AXIS_RZ)
            buttons[6] = event.getAxisValue(MotionEvent.AXIS_LTRIGGER).coerceIn(0f, 1f)
            buttons[7] = event.getAxisValue(MotionEvent.AXIS_RTRIGGER).coerceIn(0f, 1f)
            sendGamepad()
            return true
        }
        return super.onGenericMotionEvent(event)
    }

    private fun mapGamepad(keyCode: Int, value: Float): Boolean {
        val index = when (keyCode) {
            KeyEvent.KEYCODE_BUTTON_A -> 0
            KeyEvent.KEYCODE_BUTTON_B -> 1
            KeyEvent.KEYCODE_BUTTON_X -> 2
            KeyEvent.KEYCODE_BUTTON_Y -> 3
            KeyEvent.KEYCODE_BUTTON_L1 -> 4
            KeyEvent.KEYCODE_BUTTON_R1 -> 5
            KeyEvent.KEYCODE_BUTTON_SELECT -> 8
            KeyEvent.KEYCODE_BUTTON_START -> 9
            KeyEvent.KEYCODE_BUTTON_THUMBL -> 10
            KeyEvent.KEYCODE_BUTTON_THUMBR -> 11
            KeyEvent.KEYCODE_DPAD_UP -> 12
            KeyEvent.KEYCODE_DPAD_DOWN -> 13
            KeyEvent.KEYCODE_DPAD_LEFT -> 14
            KeyEvent.KEYCODE_DPAD_RIGHT -> 15
            else -> return false
        }
        buttons[index] = value
        sendGamepad()
        return true
    }

    private fun sendGamepad() {
        val state = JSONObject()
            .put("connected", true)
            .put("buttons", JSONArray(buttons.toList()))
            .put("axes", JSONArray(axes.toList()))
        socket?.send(JSONObject().put("type", "gamepad").put("index", 0).put("state", state).toString())
    }

    private fun show(text: String) {
        runOnUiThread {
            statusView.visibility = View.VISIBLE
            statusView.text = text
        }
    }

    private fun stopMedia() {
        media?.stop()
        media = null
        decoder?.stop()
        decoder = null
        audio?.stop()
        audio = null
    }

    override fun onDestroy() {
        socket?.send(JSONObject().put("type", "bye").toString())
        socket?.close(1000, "bye")
        socket = null
        stopMedia()
        super.onDestroy()
    }
}
