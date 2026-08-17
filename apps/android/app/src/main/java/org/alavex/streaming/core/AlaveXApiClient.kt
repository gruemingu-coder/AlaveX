package org.alavex.streaming.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

class AlaveXApiClient {
    private val client = OkHttpClient()
    private val json = "application/json".toMediaType()

    suspend fun login(email: String, password: String): AuthResult =
        postAuth("/auth/login", email, password)

    suspend fun signup(email: String, password: String): AuthResult =
        postAuth("/auth/signup", email, password)

    suspend fun fetchMe(token: String): AccountUser = withContext(Dispatchers.IO) {
        val body = get("/auth/me", token)
        val user = body.getJSONObject("user")
        AccountUser(user.getString("id"), user.getString("email"))
    }

    suspend fun listDevices(token: String): List<CloudDevice> = withContext(Dispatchers.IO) {
        val body = get("/devices", token)
        val arr = body.getJSONArray("devices")
        buildList {
            for (i in 0 until arr.length()) {
                val d = arr.getJSONObject(i)
                add(
                    CloudDevice(
                        id = d.getString("id"),
                        name = d.getString("name"),
                        macAddress = d.optString("macAddress").ifBlank { null },
                        lastIp = d.optString("lastIp").ifBlank { null },
                        publicHost = d.optString("publicHost").ifBlank { null },
                        signalPort = d.optInt("signalPort", AlaveXProtocol.SIGNALING_PORT),
                        pairingPin = d.optString("pairingPin").ifBlank { null },
                        lastSeenAt = d.optString("lastSeenAt"),
                    )
                )
            }
        }
    }

    private suspend fun postAuth(path: String, email: String, password: String): AuthResult =
        withContext(Dispatchers.IO) {
            val payload = JSONObject().apply {
                put("email", email)
                put("password", password)
            }.toString().toRequestBody(json)
            val req = Request.Builder()
                .url("${AlaveXProtocol.API_BASE}$path")
                .post(payload)
                .build()
            val res = client.newCall(req).execute()
            val text = res.body?.string().orEmpty()
            if (!res.isSuccessful) {
                val err = runCatching { JSONObject(text).optString("error") }.getOrNull()
                throw AlaveXApiException(err ?: "요청 실패 (${res.code})")
            }
            val obj = JSONObject(text)
            val user = obj.getJSONObject("user")
            AuthResult(
                token = obj.getString("token"),
                user = AccountUser(user.getString("id"), user.getString("email")),
            )
        }

    private fun get(path: String, token: String): JSONObject {
        val req = Request.Builder()
            .url("${AlaveXProtocol.API_BASE}$path")
            .header("Authorization", "Bearer $token")
            .get()
            .build()
        val res = client.newCall(req).execute()
        val text = res.body?.string().orEmpty()
        if (!res.isSuccessful) {
            val err = runCatching { JSONObject(text).optString("error") }.getOrNull()
            throw AlaveXApiException(err ?: "요청 실패 (${res.code})")
        }
        return JSONObject(text)
    }
}
