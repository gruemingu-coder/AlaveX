import SwiftUI
import AlaveXCore

@main
struct AlaveXStreamingApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
        }
    }
}

@MainActor
final class SessionStore: ObservableObject {
    @Published var token: String? = UserDefaults.standard.string(forKey: "alavex.token")
    @Published var user: AccountUser?
    @Published var devices: [CloudDevice] = []
    @Published var useRemoteConnection = UserDefaults.standard.bool(forKey: "alavex.remote")
    @Published var errorMessage: String?

    var isLoggedIn: Bool { token != nil }

    func login(email: String, password: String, signup: Bool = false) async {
        errorMessage = nil
        do {
            let result = signup
                ? try await AlaveXApiClient.shared.signup(email: email, password: password)
                : try await AlaveXApiClient.shared.login(email: email, password: password)
            token = result.token
            user = result.user
            UserDefaults.standard.set(result.token, forKey: "alavex.token")
            await refreshDevices()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func logout() {
        token = nil
        user = nil
        devices = []
        UserDefaults.standard.removeObject(forKey: "alavex.token")
    }

    func refreshDevices() async {
        guard let token else { return }
        do {
            devices = try await AlaveXApiClient.shared.listDevices(token: token)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func setRemote(_ value: Bool) {
        useRemoteConnection = value
        UserDefaults.standard.set(value, forKey: "alavex.remote")
    }

    func hostAddress(for device: CloudDevice) -> String {
        if useRemoteConnection, let publicHost = device.publicHost, !publicHost.isEmpty {
            return publicHost
        }
        return device.lastIp ?? device.publicHost ?? ""
    }
}

struct RootView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        Group {
            if session.isLoggedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .task {
            if let token = session.token {
                session.user = try? await AlaveXApiClient.shared.fetchMe(token: token)
                await session.refreshDevices()
            }
        }
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            DevicesView()
                .tabItem { Label("내 PC", systemImage: "desktopcomputer") }
            PairingView()
                .tabItem { Label("페어링", systemImage: "link") }
            SettingsView()
                .tabItem { Label("설정", systemImage: "gearshape") }
        }
    }
}

struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var email = ""
    @State private var password = ""
    @State private var isSignup = false
    @State private var loading = false

    var body: some View {
        VStack(spacing: 16) {
            Text("AlaveX").font(.largeTitle.bold())
            TextField("이메일", text: $email)
                .textFieldStyle(.roundedBorder)
            SecureField("비밀번호", text: $password)
                .textFieldStyle(.roundedBorder)
            if let err = session.errorMessage {
                Text(err).foregroundStyle(.red).font(.caption)
            }
            Button(isSignup ? "회원가입" : "로그인") {
                loading = true
                Task {
                    await session.login(email: email, password: password, signup: isSignup)
                    loading = false
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(loading || email.isEmpty || password.count < 8)
            Button(isSignup ? "로그인으로" : "회원가입") { isSignup.toggle() }
                .font(.caption)
        }
        .padding(24)
        .frame(maxWidth: 360)
    }
}

struct DevicesView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        NavigationView {
            List(session.devices) { device in
                VStack(alignment: .leading) {
                    Text(device.name).font(.headline)
                    Text(session.hostAddress(for: device)).font(.caption).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("내 PC")
            .refreshable { await session.refreshDevices() }
        }
    }
}

struct PairingView: View {
    @State private var address = ""
    @State private var pin = ""
    @State private var status = ""

    var body: some View {
        NavigationView {
            Form {
                Section("호스트 주소") {
                    TextField("IP 또는 DDNS", text: $address)
                    TextField("PIN (4자리)", text: $pin)
                }
                Section {
                    Button("연결 테스트") {
                        Task {
                            let client = HostSignalingClient()
                            do {
                                let res = try await client.connect(host: address, pin: pin, clientName: "AlaveX Apple")
                                status = "\(res.hostName) · 게임 \(res.games.count)개"
                            } catch {
                                status = error.localizedDescription
                            }
                        }
                    }
                    if !status.isEmpty {
                        Text(status).font(.caption)
                    }
                }
            }
            .navigationTitle("PC 페어링")
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        NavigationView {
            Form {
                Toggle("외부(포트 포워딩) 연결", isOn: Binding(
                    get: { session.useRemoteConnection },
                    set: { session.setRemote($0) }
                ))
                Section("포트 (Sunshine 호환)") {
                    HStack {
                        Text("시그널링 TCP")
                        Spacer()
                        Text("\(AlaveXProtocol.signalingPort)")
                    }
                    HStack {
                        Text("미디어 UDP")
                        Spacer()
                        Text("\(AlaveXProtocol.mediaPort)")
                    }
                }
                Button("로그아웃", role: .destructive) { session.logout() }
            }
            .navigationTitle("설정")
        }
    }
}
