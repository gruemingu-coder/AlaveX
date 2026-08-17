package org.alavex.streaming.core

object AlaveXProtocol {
    const val API_BASE = "https://alavex.pages.dev/api"
    const val SIGNALING_PORT = 47989
    const val MEDIA_PORT = 47998
    const val DISCOVERY_PORT = 47999
    const val APP_VERSION = "0.5.0"
}

data class AccountUser(val id: String, val email: String)
data class AuthResult(val token: String, val user: AccountUser)
data class CloudDevice(
    val id: String,
    val name: String,
    val macAddress: String? = null,
    val lastIp: String? = null,
    val publicHost: String? = null,
    val signalPort: Int = AlaveXProtocol.SIGNALING_PORT,
    val pairingPin: String? = null,
    val lastSeenAt: String = "",
) {
    fun resolvedAddress(useRemote: Boolean): String {
        if (useRemote && !publicHost.isNullOrBlank()) return publicHost
        return lastIp ?: publicHost.orEmpty()
    }
}

data class RemoteGame(val id: String, val title: String)

class AlaveXApiException(message: String) : Exception(message)
