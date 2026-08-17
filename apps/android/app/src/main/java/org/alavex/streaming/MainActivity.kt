package org.alavex.streaming

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.alavex.streaming.core.AlaveXProtocol
import org.alavex.streaming.core.CloudDevice
import org.alavex.streaming.core.HostSignalingClient

class MainActivity : ComponentActivity() {
    private val session by viewModels<SessionViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    AlaveXApp(session)
                }
            }
        }
    }
}

@Composable
fun AlaveXApp(session: SessionViewModel) {
    val token by session.token.collectAsState()
    if (token == null) LoginScreen(session) else MainTabs(session)
}

@Composable
fun LoginScreen(session: SessionViewModel) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var signup by remember { mutableStateOf(false) }
    val error by session.error.collectAsState()

    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("AlaveX", style = MaterialTheme.typography.headlineLarge)
        OutlinedTextField(email, { email = it }, label = { Text("이메일") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(password, { password = it }, label = { Text("비밀번호") }, modifier = Modifier.fillMaxWidth())
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        Button(
            onClick = { session.login(email, password, signup) },
            enabled = email.isNotBlank() && password.length >= 8,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (signup) "회원가입" else "로그인") }
        TextButton(onClick = { signup = !signup }) {
            Text(if (signup) "로그인으로" else "회원가입")
        }
    }
}

@Composable
fun MainTabs(session: SessionViewModel) {
    var tab by remember { mutableIntStateOf(0) }
    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(selected = tab == 0, onClick = { tab = 0 }, icon = { Text("PC") }, label = { Text("내 PC") })
                NavigationBarItem(selected = tab == 1, onClick = { tab = 1 }, icon = { Text("🔗") }, label = { Text("페어링") })
                NavigationBarItem(selected = tab == 2, onClick = { tab = 2 }, icon = { Text("⚙") }, label = { Text("설정") })
            }
        }
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (tab) {
                0 -> DevicesScreen(session)
                1 -> PairingScreen()
                2 -> SettingsScreen(session)
            }
        }
    }
}

@Composable
fun DevicesScreen(session: SessionViewModel) {
    val devices by session.devices.collectAsState()
    val useRemote by session.useRemote.collectAsState()
    LaunchedEffect(Unit) { session.refreshDevices() }
    LazyColumn(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(devices) { device ->
            DeviceRow(device, useRemote)
        }
    }
}

@Composable
fun DeviceRow(device: CloudDevice, useRemote: Boolean) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text(device.name, style = MaterialTheme.typography.titleMedium)
            Text(device.resolvedAddress(useRemote), style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
fun PairingScreen() {
    var address by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(address, { address = it }, label = { Text("IP 또는 DDNS") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(pin, { pin = it }, label = { Text("PIN") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = {
            scope.launch {
                runCatching {
                    HostSignalingClient().connect(address, pin = pin)
                }.onSuccess { res ->
                    status = "${res.hostName} · 게임 ${res.games.size}개"
                }.onFailure {
                    status = it.message ?: "연결 실패"
                }
            }
        }) { Text("연결 테스트") }
        if (status.isNotBlank()) Text(status, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
fun SettingsScreen(session: SessionViewModel) {
    val useRemote by session.useRemote.collectAsState()
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("외부(포트 포워딩) 연결")
            Switch(checked = useRemote, onCheckedChange = session::setRemote)
        }
        Text("시그널링 TCP: ${AlaveXProtocol.SIGNALING_PORT}")
        Text("미디어 UDP: ${AlaveXProtocol.MEDIA_PORT}")
        Button(onClick = session::logout) { Text("로그아웃") }
    }
}
