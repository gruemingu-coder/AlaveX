package org.alavex.streaming

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.alavex.streaming.core.AccountUser
import org.alavex.streaming.core.AlaveXApiClient
import org.alavex.streaming.core.CloudDevice

class SessionViewModel(app: Application) : AndroidViewModel(app) {
    private val api = AlaveXApiClient()
    private val prefs = app.getSharedPreferences("alavex", 0)

    private val _token = MutableStateFlow(prefs.getString("token", null))
    val token: StateFlow<String?> = _token.asStateFlow()

    private val _user = MutableStateFlow<AccountUser?>(null)
    val user: StateFlow<AccountUser?> = _user.asStateFlow()

    private val _devices = MutableStateFlow<List<CloudDevice>>(emptyList())
    val devices: StateFlow<List<CloudDevice>> = _devices.asStateFlow()

    private val _useRemote = MutableStateFlow(prefs.getBoolean("remote", false))
    val useRemote: StateFlow<Boolean> = _useRemote.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    val isLoggedIn: Boolean get() = _token.value != null

    init {
        viewModelScope.launch {
            _token.value?.let { refresh(it) }
        }
    }

    fun login(email: String, password: String, signup: Boolean = false) {
        viewModelScope.launch {
            _error.value = null
            runCatching {
                if (signup) api.signup(email, password) else api.login(email, password)
            }.onSuccess { result ->
                prefs.edit().putString("token", result.token).apply()
                _token.value = result.token
                _user.value = result.user
                refresh(result.token)
            }.onFailure {
                _error.value = it.message
            }
        }
    }

    fun logout() {
        prefs.edit().clear().apply()
        _token.value = null
        _user.value = null
        _devices.value = emptyList()
    }

    fun setRemote(value: Boolean) {
        prefs.edit().putBoolean("remote", value).apply()
        _useRemote.value = value
    }

    fun refreshDevices() {
        _token.value?.let { refresh(it) }
    }

    private suspend fun refresh(token: String) {
        runCatching {
            _user.value = api.fetchMe(token)
            _devices.value = api.listDevices(token)
        }.onFailure { _error.value = it.message }
    }
}
