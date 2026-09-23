import SwiftUI
import AlaveXCore

#if os(macOS)
private let clientName = "AlaveX macOS"
private let platformLabel = "macOS · SwiftUI"
#else
private let clientName = "AlaveX iOS"
private let platformLabel = "iPhone · SwiftUI"
#endif

private enum AlaveXTheme {
    static let ink = Color(red: 0.071, green: 0.063, blue: 0.051)
    static let panel = Color(red: 0.14, green: 0.125, blue: 0.105)
    static let copper = Color(red: 0.769, green: 0.384, blue: 0.157)
    static let text = Color(red: 0.93, green: 0.90, blue: 0.84)
    static let muted = Color(red: 0.62, green: 0.58, blue: 0.52)
}

@main
struct AlaveXStreamingApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .preferredColorScheme(.dark)
                .tint(AlaveXTheme.copper)
        }
        #if os(macOS)
        .defaultSize(width: 880, height: 600)
        #endif
    }
}

private enum AppSection: String, CaseIterable, Identifiable, Hashable {
    case devices
    case pairing
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .devices: return "내 PC"
        case .pairing: return "페어링"
        case .settings: return "설정"
        }
    }

    var symbol: String {
        switch self {
        case .devices: return "desktopcomputer"
        case .pairing: return "link"
        case .settings: return "gearshape"
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
    @Published var draftHost = ""
    @Published var draftPin = ""
    @Published var section: AppSection = .devices

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

    func preparePairing(for device: CloudDevice) {
        draftHost = hostAddress(for: device)
        draftPin = device.pairingPin ?? ""
        section = .pairing
    }
}

struct RootView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        Group {
            if session.isLoggedIn {
                MainShell()
            } else {
                LoginView()
            }
        }
        .background(AlaveXTheme.ink)
        .task {
            if let token = session.token {
                session.user = try? await AlaveXApiClient.shared.fetchMe(token: token)
                await session.refreshDevices()
            }
        }
    }
}

struct MainShell: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        #if os(macOS)
        NavigationSplitView {
            List(AppSection.allCases, selection: sectionBinding) { item in
                Label(item.title, systemImage: item.symbol)
                    .tag(item)
            }
            .navigationTitle("AlaveX")
        } detail: {
            sectionView(session.section)
        }
        .frame(minWidth: 760, minHeight: 520)
        #else
        TabView(selection: $session.section) {
            NavigationStack {
                DevicesView()
            }
            .tabItem { Label("내 PC", systemImage: "desktopcomputer") }
            .tag(AppSection.devices)

            NavigationStack {
                PairingView()
            }
            .tabItem { Label("페어링", systemImage: "link") }
            .tag(AppSection.pairing)

            NavigationStack {
                SettingsView()
            }
            .tabItem { Label("설정", systemImage: "gearshape") }
            .tag(AppSection.settings)
        }
        #endif
    }

    private var sectionBinding: Binding<AppSection?> {
        Binding(
            get: { session.section },
            set: { if let newValue = $0 { session.section = newValue } }
        )
    }

    @ViewBuilder
    private func sectionView(_ section: AppSection) -> some View {
        switch section {
        case .devices:
            DevicesView()
        case .pairing:
            PairingView()
        case .settings:
            SettingsView()
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
        VStack(alignment: .leading, spacing: 16) {
            Text("AlaveX")
                .font(.largeTitle.bold())
                .foregroundStyle(AlaveXTheme.text)
            Text(platformLabel)
                .font(.subheadline)
                .foregroundStyle(AlaveXTheme.copper)
            TextField("이메일", text: $email)
                #if os(iOS)
                .textInputAutocapitalization(.never)
                .keyboardType(.emailAddress)
                #endif
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
                .foregroundStyle(AlaveXTheme.muted)
        }
        .padding(28)
        .frame(maxWidth: 380)
        .background(AlaveXTheme.panel)
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AlaveXTheme.ink)
    }
}

struct DevicesView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        List {
            if session.devices.isEmpty {
                Text("등록된 PC가 없습니다. 호스트에서 같은 계정으로 로그인한 뒤 새로고침하세요.")
                    .font(.caption)
                    .foregroundStyle(AlaveXTheme.muted)
            }
            ForEach(session.devices) { device in
                VStack(alignment: .leading, spacing: 6) {
                    Text(device.name)
                        .font(.headline)
                        .foregroundStyle(AlaveXTheme.text)
                    Text(session.hostAddress(for: device))
                        .font(.caption)
                        .foregroundStyle(AlaveXTheme.muted)
                    Button("이 PC에 연결") {
                        session.preparePairing(for: device)
                    }
                    .font(.caption)
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle("내 PC")
        .refreshable { await session.refreshDevices() }
        .toolbar {
            Button("새로고침") {
                Task { await session.refreshDevices() }
            }
        }
    }
}

struct PairingView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var status = ""
    @State private var busy = false

    var body: some View {
        Form {
            Section("호스트 주소") {
                TextField("IP 또는 DDNS", text: $session.draftHost)
                    #if os(iOS)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    #endif
                TextField("PIN (4자리)", text: $session.draftPin)
            }
            Section {
                Button(busy ? "연결 중…" : "연결 테스트") {
                    Task { await testConnection() }
                }
                .disabled(busy || session.draftHost.isEmpty || session.draftPin.count < 4)
                if !status.isEmpty {
                    Text(status).font(.caption)
                }
            }
        }
        .navigationTitle("PC 페어링")
    }

    private func testConnection() async {
        busy = true
        status = ""
        let client = HostSignalingClient()
        do {
            let res = try await client.connect(
                host: session.draftHost,
                pin: session.draftPin,
                clientName: clientName
            )
            status = "\(res.hostName) · 게임 \(res.games.count)개"
        } catch {
            status = error.localizedDescription
        }
        busy = false
    }
}

struct SettingsView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        Form {
            if let email = session.user?.email {
                Section("계정") {
                    Text(email)
                }
            }
            Toggle("외부(포트 포워딩) 연결", isOn: Binding(
                get: { session.useRemoteConnection },
                set: { session.setRemote($0) }
            ))
            Section("포트") {
                LabeledContent("시그널링 TCP", value: "\(AlaveXProtocol.signalingPort)")
                LabeledContent("미디어 UDP", value: "\(AlaveXProtocol.mediaPort)")
                LabeledContent("UI", value: platformLabel)
            }
            Button("로그아웃", role: .destructive) { session.logout() }
        }
        .navigationTitle("설정")
    }
}
