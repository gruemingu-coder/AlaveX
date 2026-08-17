import Foundation

public enum AlaveXProtocol {
    public static let apiBaseURL = URL(string: "https://alavex.pages.dev/api")!
    public static let signalingPort: UInt16 = 47989
    public static let mediaPort: UInt16 = 47998
    public static let discoveryPort: UInt16 = 47999
    public static let appVersion = "0.5.0"
}

public struct AccountUser: Codable, Sendable {
    public let id: String
    public let email: String
}

public struct AuthResult: Codable, Sendable {
    public let token: String
    public let user: AccountUser
}

public struct CloudDevice: Codable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let macAddress: String?
    public let lastIp: String?
    public let publicHost: String?
    public let signalPort: Int
    public let pairingPin: String?
    public let lastSeenAt: String

    public var resolvedAddress: String {
        lastIp ?? publicHost ?? ""
    }
}

public struct RemoteGame: Codable, Identifiable, Sendable {
    public let id: String
    public let title: String
}

public enum AlaveXApiError: LocalizedError, Sendable {
    case network(String)
    case server(String)

    public var errorDescription: String? {
        switch self {
        case .network(let msg): return msg
        case .server(let msg): return msg
        }
    }
}

public actor AlaveXApiClient {
    public static let shared = AlaveXApiClient()
    private init() {}

    public func login(email: String, password: String) async throws -> AuthResult {
        try await post("/auth/login", body: ["email": email, "password": password])
    }

    public func signup(email: String, password: String) async throws -> AuthResult {
        try await post("/auth/signup", body: ["email": email, "password": password])
    }

    public func fetchMe(token: String) async throws -> AccountUser {
        let res: MeResponse = try await get("/auth/me", token: token)
        return res.user
    }

    public func listDevices(token: String) async throws -> [CloudDevice] {
        let res: DevicesResponse = try await get("/devices", token: token)
        return res.devices
    }

    private struct MeResponse: Codable { let user: AccountUser }
    private struct DevicesResponse: Codable { let devices: [CloudDevice] }
    private struct ErrorBody: Codable { let error: String? }

    private func get<T: Decodable>(_ path: String, token: String) async throws -> T {
        var req = URLRequest(url: AlaveXProtocol.apiBaseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))))
        req.httpMethod = "GET"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return try await send(req)
    }

    private func post<T: Decodable>(_ path: String, body: [String: String]) async throws -> T {
        var req = URLRequest(url: AlaveXProtocol.apiBaseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(body)
        return try await send(req)
    }

    private func send<T: Decodable>(_ req: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch {
            throw AlaveXApiError.network("서버에 연결할 수 없습니다.")
        }
        guard let http = response as? HTTPURLResponse else {
            throw AlaveXApiError.network("잘못된 응답입니다.")
        }
        if http.statusCode >= 400 {
            let err = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
            throw AlaveXApiError.server(err ?? "요청 실패 (\(http.statusCode))")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
