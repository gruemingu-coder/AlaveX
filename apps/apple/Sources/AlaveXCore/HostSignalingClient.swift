import Foundation

/// WebSocket signaling client (PIN auth + game list). LLU2 UDP decode is platform-specific follow-up.
public final class HostSignalingClient: NSObject, URLSessionWebSocketDelegate {
    public struct HandshakeResult {
        public let hostName: String
        public let games: [RemoteGame]
        public let macAddress: String?
        public let mediaPort: UInt16
        public let mediaToken: String?
    }

    private var task: URLSessionWebSocketTask?
    private var continuation: CheckedContinuation<HandshakeResult, Error>?

    public func connect(host: String, port: UInt16 = AlaveXProtocol.signalingPort, pin: String, clientName: String) async throws -> HandshakeResult {
        let url = URL(string: "ws://\(host):\(port)/signal?role=client")!
        let session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
        task = session.webSocketTask(with: url)
        task?.resume()

        try await send(["type": "auth", "pin": pin, "clientName": clientName])

        return try await withCheckedThrowingContinuation { cont in
            self.continuation = cont
            receiveLoop()
        }
    }

    public func close() {
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }

    private func receiveLoop() {
        task?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let err):
                self.continuation?.resume(throwing: err)
                self.continuation = nil
            case .success(let message):
                self.handle(message)
                self.receiveLoop()
            }
        }
    }

    private func handle(_ message: URLSessionWebSocketTask.Message) {
        guard case .string(let text) = message,
              let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else { return }

        switch type {
        case "auth-fail":
            let reason = json["reason"] as? String ?? "PIN 오류"
            continuation?.resume(throwing: AlaveXApiError.server(reason))
            continuation = nil
        case "auth-ok":
            break
        case "games":
            guard let gamesRaw = json["games"] as? [[String: Any]] else { return }
            let games = gamesRaw.compactMap { g -> RemoteGame? in
                guard let id = g["id"] as? String, let title = g["title"] as? String else { return nil }
                return RemoteGame(id: id, title: title)
            }
            let hostName = json["hostName"] as? String ?? "Host"
            let mac = json["macAddress"] as? String
            let mediaPort = UInt16(json["mediaPort"] as? Int ?? Int(AlaveXProtocol.mediaPort))
            let token = json["mediaToken"] as? String
            continuation?.resume(returning: HandshakeResult(
                hostName: hostName,
                games: games,
                macAddress: mac,
                mediaPort: mediaPort,
                mediaToken: token
            ))
            continuation = nil
            close()
        default:
            break
        }
    }

    private func send(_ dict: [String: Any]) async throws {
        let data = try JSONSerialization.data(withJSONObject: dict)
        guard let text = String(data: data, encoding: .utf8) else { return }
        try await task?.send(.string(text))
    }
}
