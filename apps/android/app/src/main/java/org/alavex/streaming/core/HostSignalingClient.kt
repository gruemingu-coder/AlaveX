package org.alavex.streaming.core

import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class HostSignalingClient {
    data class HandshakeResult(
        val hostName: String,
        val games: List<RemoteGame>,
        val macAddress: String?,
        val mediaPort: Int,
        val mediaToken: String?,
    )

    suspend fun connect(
        host: String,
        port: Int = AlaveXProtocol.SIGNALING_PORT,
        pin: String,
        clientName: String = "AlaveX Android",
    ): HandshakeResult = suspendCancellableCoroutine { cont ->
        val url = "ws://$host:$port/signal?role=client"
        val client = OkHttpClient()
        val request = Request.Builder().url(url).build()
        val listener = object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                val msg = JSONObject()
                    .put("type", "auth")
                    .put("pin", pin)
                    .put("clientName", clientName)
                webSocket.send(msg.toString())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val json = runCatching { JSONObject(text) }.getOrNull() ?: return
                when (json.optString("type")) {
                    "auth-fail" -> {
                        webSocket.close(1000, null)
                        cont.resumeWithException(
                            AlaveXApiException(json.optString("reason", "PIN 오류"))
                        )
                    }
                    "games" -> {
                        val games = buildList {
                            val arr = json.optJSONArray("games") ?: JSONArray()
                            for (i in 0 until arr.length()) {
                                val g = arr.getJSONObject(i)
                                add(RemoteGame(g.getString("id"), g.getString("title")))
                            }
                        }
                        webSocket.close(1000, null)
                        cont.resume(
                            HandshakeResult(
                                hostName = json.optString("hostName", "Host"),
                                games = games,
                                macAddress = json.optString("macAddress").ifBlank { null },
                                mediaPort = json.optInt("mediaPort", AlaveXProtocol.MEDIA_PORT),
                                mediaToken = json.optString("mediaToken").ifBlank { null },
                            )
                        )
                    }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                cont.resumeWithException(t)
            }
        }
        val ws = client.newWebSocket(request, listener)
        cont.invokeOnCancellation { ws.cancel() }
    }
}
