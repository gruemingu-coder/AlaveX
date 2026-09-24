package org.alavex.streaming

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AlaveXPlayerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "AlaveXPlayer"

    @ReactMethod
    fun play(host: String, pin: String, gameId: String?) {
        val activity = reactApplicationContext.currentActivity ?: return
        val intent = Intent(activity, PlayerActivity::class.java)
        intent.putExtra("host", host)
        intent.putExtra("pin", pin)
        if (!gameId.isNullOrBlank()) intent.putExtra("gameId", gameId)
        activity.startActivity(intent)
    }
}
