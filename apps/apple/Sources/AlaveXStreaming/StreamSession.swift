import Foundation
import Network
import AVFoundation
import AudioToolbox
import CoreMedia
import VideoToolbox
import GameController
import SwiftUI

#if os(iOS)
import UIKit
#else
import AppKit
#endif

/// Plays an AlaveX host: signaling, LLU2 UDP, H.264 display, AAC, touch and gamepad.
@MainActor
final class StreamSession: ObservableObject {
    @Published var status = "호스트에 연결하는 중…"
    @Published var playing = false
    let displayLayer = AVSampleBufferDisplayLayer()

    private let host: String
    private let pin: String
    private var mediaToken = ""
    private var socket: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var udp: NWConnection?
    private var receiver: Llu2Receiver?
    private let queue = DispatchQueue(label: "alavex.stream")
    private var format: CMVideoFormatDescription?
    private var audio: AacQueue?
    private var gamepadTimer: Timer?

    init(host: String, pin: String) {
        self.host = host
        self.pin = pin
        displayLayer.videoGravity = .resizeAspect
    }

    func start() {
        let session = URLSession(configuration: .default)
        urlSession = session
        let url = URL(string: "ws://\(host):47989/signal?role=client")!
        let task = session.webSocketTask(with: url)
        socket = task
        task.resume()
        sendJSON(["type": "auth", "pin": pin, "clientName": "AlaveX iOS"])
        receive()
        startGamepad()
    }

    func stop() {
        gamepadTimer?.invalidate()
        sendJSON(["type": "bye"])
        socket?.cancel(with: .goingAway, reason: nil)
        socket = nil
        udp?.cancel()
        udp = nil
        receiver?.stop()
        receiver = nil
        audio?.stop()
        audio = nil
    }

    func pointer(type: String, x: Double, y: Double) {
        sendJSON([
            "type": "input",
            "event": ["type": type, "x": x, "y": y],
        ])
    }

    private func receive() {
        socket?.receive { [weak self] result in
            Task { @MainActor in
                guard let self else { return }
                switch result {
                case .failure(let error):
                    self.status = "시그널링 실패: \(error.localizedDescription)"
                case .success(let message):
                    if case .string(let text) = message {
                        self.handle(text)
                    }
                    self.receive()
                }
            }
        }
    }

    private func handle(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else { return }
        switch type {
        case "auth-fail":
            status = json["reason"] as? String ?? "PIN 오류"
        case "auth-ok":
            mediaToken = json["mediaToken"] as? String ?? pin
            status = "\(json["hostName"] as? String ?? "Host") 스트리밍 시작"
            sendJSON([
                "type": "start-stream",
                "gameId": "desktop",
                "quality": [
                    "resolution": "1080p",
                    "fps": 120,
                    "bitrateMbps": 25,
                    "codec": "h264",
                    "hostAudio": true,
                    "streamStartAction": "desktop",
                    "latencyMode": "latency",
                ],
            ])
        case "stream-ready":
            let port = UInt16(json["mediaPort"] as? Int ?? 47998)
            openMedia(port: port)
        default:
            break
        }
    }

    private func openMedia(port: UInt16) {
        let connection = NWConnection(
            host: NWEndpoint.Host(host),
            port: NWEndpoint.Port(rawValue: port)!,
            using: .udp
        )
        udp = connection
        let token = mediaToken.isEmpty ? pin : mediaToken
        let receiver = Llu2Receiver(connection: connection, credential: token)
        self.receiver = receiver
        receiver.onVideo = { [weak self] frame, key in
            Task { @MainActor in self?.show(frame, key: key) }
        }
        receiver.onAudio = { [weak self] adts in
            Task { @MainActor in self?.playAudio(adts) }
        }
        receiver.onError = { [weak self] message in
            Task { @MainActor in self?.status = message }
        }
        receiver.onPlaying = { [weak self] in
            Task { @MainActor in
                self?.playing = true
                self?.status = "재생 중"
            }
        }
        connection.stateUpdateHandler = { state in
            if case .failed(let error) = state {
                Task { @MainActor in self.status = "UDP 실패: \(error.localizedDescription)" }
            }
        }
        connection.start(queue: queue)
        receiver.start()
    }

    private func show(_ annexB: Data, key: Bool) {
        let nals = AnnexB.split(annexB)
        let sps = nals.first { !$0.isEmpty && ($0[0] & 0x1F) == 7 }
        let pps = nals.first { !$0.isEmpty && ($0[0] & 0x1F) == 8 }
        if format == nil, let sps, let pps {
            format = AnnexB.formatDescription(sps: sps, pps: pps)
        }
        guard let format else { return }
        let vcl = nals.filter {
            guard let b = $0.first else { return false }
            let t = b & 0x1F
            return t == 1 || t == 5
        }
        guard !vcl.isEmpty, let sample = AnnexB.sampleBuffer(nals: vcl, format: format, key: key) else { return }
        if displayLayer.status == .failed {
            displayLayer.flush()
        }
        displayLayer.enqueue(sample)
    }

    private func playAudio(_ adts: Data) {
        if audio == nil { audio = AacQueue() }
        audio?.enqueue(adts)
    }

    private func startGamepad() {
        gamepadTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.sendGamepad() }
        }
    }

    private func sendGamepad() {
        guard let pad = GCController.controllers().first?.extendedGamepad else { return }
        let b = pad
        let buttons: [Float] = [
            b.buttonA.isPressed ? 1 : 0,
            b.buttonB.isPressed ? 1 : 0,
            b.buttonX.isPressed ? 1 : 0,
            b.buttonY.isPressed ? 1 : 0,
            b.leftShoulder.isPressed ? 1 : 0,
            b.rightShoulder.isPressed ? 1 : 0,
            b.leftTrigger.value,
            b.rightTrigger.value,
            b.buttonOptions?.isPressed == true ? 1 : 0,
            b.buttonMenu.isPressed ? 1 : 0,
            b.leftThumbstickButton?.isPressed == true ? 1 : 0,
            b.rightThumbstickButton?.isPressed == true ? 1 : 0,
            b.dpad.up.isPressed ? 1 : 0,
            b.dpad.down.isPressed ? 1 : 0,
            b.dpad.left.isPressed ? 1 : 0,
            b.dpad.right.isPressed ? 1 : 0,
            0,
        ]
        let axes: [Float] = [
            b.leftThumbstick.xAxis.value,
            -b.leftThumbstick.yAxis.value,
            b.rightThumbstick.xAxis.value,
            -b.rightThumbstick.yAxis.value,
        ]
        sendJSON([
            "type": "gamepad",
            "index": 0,
            "state": ["connected": true, "buttons": buttons, "axes": axes],
        ])
    }

    private func sendJSON(_ object: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: object),
              let text = String(data: data, encoding: .utf8) else { return }
        socket?.send(.string(text)) { _ in }
    }
}

struct StreamPlayerView: View {
    @StateObject private var session: StreamSession
    @Environment(\.dismiss) private var dismiss

    init(host: String, pin: String) {
        _session = StateObject(wrappedValue: StreamSession(host: host, pin: pin))
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.black.ignoresSafeArea()
            SampleBufferView(layer: session.displayLayer)
                .ignoresSafeArea()
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            send(value, type: "pointermove")
                        }
                        .onEnded { value in
                            send(value, type: "pointerup")
                        }
                )
                .simultaneousGesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            if value.translation == .zero {
                                send(value, type: "pointerdown")
                            }
                        }
                )
            if !session.playing {
                Text(session.status)
                    .foregroundStyle(.white)
                    .padding()
            }
            VStack {
                Spacer()
                HStack {
                    Button("Esc") { session.sendEscape() }
                        .buttonStyle(.bordered)
                    Button("닫기") {
                        session.stop()
                        dismiss()
                    }
                    .buttonStyle(.bordered)
                }
                .padding()
            }
        }
        .onAppear { session.start() }
        .onDisappear { session.stop() }
        #if os(iOS)
        .statusBarHidden(true)
        #endif
    }

    private func send(_ value: DragGesture.Value, type: String) {
        #if os(iOS)
        let bounds = UIScreen.main.bounds
        #else
        let bounds = NSScreen.main?.frame ?? CGRect(x: 0, y: 0, width: 1280, height: 720)
        #endif
        let x = min(max(value.location.x / bounds.width, 0), 1)
        let y = min(max(value.location.y / bounds.height, 0), 1)
        session.pointer(type: type, x: x, y: y)
    }
}

extension StreamSession {
    func sendEscape() {
        sendJSON(["type": "input", "event": ["type": "keydown", "key": "Escape"]])
        sendJSON(["type": "input", "event": ["type": "keyup", "key": "Escape"]])
    }
}

#if os(iOS)
private struct SampleBufferView: UIViewRepresentable {
    let layer: AVSampleBufferDisplayLayer

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .black
        layer.frame = view.bounds
        view.layer.addSublayer(layer)
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        layer.frame = uiView.bounds
    }
}
#else
import AppKit
private struct SampleBufferView: NSViewRepresentable {
    let layer: AVSampleBufferDisplayLayer

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        view.wantsLayer = true
        view.layer?.addSublayer(layer)
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        layer.frame = nsView.bounds
    }
}
#endif

private enum AnnexB {
    static func split(_ data: Data) -> [Data] {
        var starts: [Int] = []
        var i = 0
        let bytes = [UInt8](data)
        while i + 3 < bytes.count {
            if bytes[i] == 0 && bytes[i + 1] == 0 {
                if bytes[i + 2] == 1 {
                    starts.append(i + 3)
                    i += 3
                    continue
                }
                if i + 3 < bytes.count && bytes[i + 2] == 0 && bytes[i + 3] == 1 {
                    starts.append(i + 4)
                    i += 4
                    continue
                }
            }
            i += 1
        }
        var out: [Data] = []
        for n in starts.indices {
            let from = starts[n]
            var to = n + 1 < starts.count ? starts[n + 1] : bytes.count
            if n + 1 < starts.count {
                while to > from && bytes[to - 1] == 0 { to -= 1 }
            }
            if to > from { out.append(Data(bytes[from..<to])) }
        }
        return out
    }

    static func formatDescription(sps: Data, pps: Data) -> CMVideoFormatDescription? {
        var description: CMVideoFormatDescription?
        let status = sps.withUnsafeBytes { (spsRaw: UnsafeRawBufferPointer) in
            pps.withUnsafeBytes { (ppsRaw: UnsafeRawBufferPointer) -> OSStatus in
                let spsPointer = spsRaw.bindMemory(to: UInt8.self).baseAddress!
                let ppsPointer = ppsRaw.bindMemory(to: UInt8.self).baseAddress!
                let pointers = [spsPointer, ppsPointer]
                let sizes = [sps.count, pps.count]
                return pointers.withUnsafeBufferPointer { pointerBuffer in
                    sizes.withUnsafeBufferPointer { sizeBuffer in
                        CMVideoFormatDescriptionCreateFromH264ParameterSets(
                            allocator: kCFAllocatorDefault,
                            parameterSetCount: 2,
                            parameterSetPointers: pointerBuffer.baseAddress!,
                            parameterSetSizes: sizeBuffer.baseAddress!,
                            nalUnitHeaderLength: 4,
                            formatDescriptionOut: &description
                        )
                    }
                }
            }
        }
        return status == noErr ? description : nil
    }

    static func sampleBuffer(nals: [Data], format: CMVideoFormatDescription, key: Bool) -> CMSampleBuffer? {
        var length = 0
        for nal in nals { length += 4 + nal.count }
        var avcc = Data(count: length)
        var offset = 0
        for nal in nals {
            let size = UInt32(nal.count).bigEndian
            withUnsafeBytes(of: size) { avcc.replaceSubrange(offset..<offset + 4, with: $0) }
            offset += 4
            avcc.replaceSubrange(offset..<offset + nal.count, with: nal)
            offset += nal.count
        }
        var block: CMBlockBuffer?
        guard CMBlockBufferCreateWithMemoryBlock(
            allocator: kCFAllocatorDefault,
            memoryBlock: nil,
            blockLength: avcc.count,
            blockAllocator: kCFAllocatorDefault,
            customBlockSource: nil,
            offsetToData: 0,
            dataLength: avcc.count,
            flags: 0,
            blockBufferOut: &block
        ) == kCMBlockBufferNoErr, let block else { return nil }
        let copied = avcc.withUnsafeBytes { raw in
            CMBlockBufferReplaceDataBytes(
                with: raw.baseAddress!,
                blockBuffer: block,
                offsetIntoDestination: 0,
                dataLength: avcc.count
            )
        }
        guard copied == kCMBlockBufferNoErr else { return nil }
        var sample: CMSampleBuffer?
        var timing = CMSampleTimingInfo(
            duration: .invalid,
            presentationTimeStamp: CMClockGetTime(CMClockGetHostTimeClock()),
            decodeTimeStamp: .invalid
        )
        var sampleSize = avcc.count
        let status = CMSampleBufferCreateReady(
            allocator: kCFAllocatorDefault,
            dataBuffer: block,
            formatDescription: format,
            sampleCount: 1,
            sampleTimingEntryCount: 1,
            sampleTimingArray: &timing,
            sampleSizeEntryCount: 1,
            sampleSizeArray: &sampleSize,
            sampleBufferOut: &sample
        )
        guard status == noErr, let sample else { return nil }
        if key, let attachments = CMSampleBufferGetSampleAttachmentsArray(sample, createIfNecessary: true) {
            let array = attachments as NSArray
            if let dict = array.firstObject as? NSMutableDictionary {
                dict[kCMSampleAttachmentKey_DependsOnOthers] = false
            }
        }
        return sample
    }
}

/// UDP LLU2 receive loop. Matches `src-tauri/src/media_client.rs`.
private final class Llu2Receiver {
    var onVideo: ((Data, Bool) -> Void)?
    var onAudio: ((Data) -> Void)?
    var onError: ((String) -> Void)?
    var onPlaying: (() -> Void)?

    private let connection: NWConnection
    private let credential: String
    private let queue = DispatchQueue(label: "alavex.llu2")
    private var stopped = false
    private var sessionId: UInt32 = 0
    private var authed = false
    private var key = Data(count: 16)

    init(connection: NWConnection, credential: String) {
        self.connection = connection
        self.credential = credential
    }

    func start() {
        key = Llu2.key(credential)
        let auth = Data("LLU2".utf8) + Data([0x01]) + Data(credential.utf8)
        send(auth)
        pump()
        queue.asyncAfter(deadline: .now() + 5) { [weak self] in
            guard let self, !self.authed, !self.stopped else { return }
            self.onError?("호스트 미디어 포트(UDP 47998) 응답이 없습니다. 같은 Wi-Fi인지 확인하세요.")
        }
    }

    func stop() { stopped = true }

    private func pump() {
        connection.receiveMessage { [weak self] data, _, _, error in
            guard let self, !self.stopped else { return }
            if let data { self.handle(data) }
            if error == nil { self.pump() }
        }
    }

    private func handle(_ data: Data) {
        let bytes = [UInt8](data)
        guard bytes.count >= 5, bytes[0] == 0x4C, bytes[1] == 0x4C, bytes[2] == 0x55, bytes[3] == 0x32 else { return }
        switch bytes[4] {
        case 0x81 where bytes.count >= 15:
            sessionId = Llu2.u32(bytes, 5)
            authed = true
            onPlaying?()
            pingLoop()
        case 0x82:
            onError?("미디어 인증에 실패했습니다. PIN을 확인하세요.")
        case 0x10 where authed && bytes.count >= 22:
            handleVideo(bytes)
        case 0x11 where authed && bytes.count >= 18:
            handleAudio(bytes)
        default:
            break
        }
    }

    private var pending: [UInt32: Partial] = [:]
    private var lastEmitted: UInt32 = 0
    private var waitingForKey = true

    private func handleVideo(_ bytes: [UInt8]) {
        guard Llu2.u32(bytes, 5) == sessionId else { return }
        let frameId = Llu2.u32(bytes, 9)
        let fragIdx = Int(Llu2.u16(bytes, 13))
        let fragCnt = Int(Llu2.u16(bytes, 15))
        let flags = Int(bytes[17])
        let expect = Llu2.u32(bytes, 18)
        guard fragCnt > 0, fragIdx < fragCnt, fragCnt <= 4096 else { return }
        var payload = Data(bytes[22...])
        if flags & 0x02 != 0 { Llu2.xor(&payload, key: key, frameId: frameId, fragIdx: UInt16(fragIdx)) }
        guard Llu2.crc32(payload) == expect else { return }
        if waitingForKey && flags & 0x01 == 0 { return }
        var entry = pending[frameId] ?? Partial(count: fragCnt)
        guard entry.parts.count == fragCnt else { return }
        if entry.parts[fragIdx] == nil {
            entry.parts[fragIdx] = payload
            entry.flags |= flags
        }
        pending[frameId] = entry
        guard entry.parts.allSatisfy({ $0 != nil }) else { return }
        var assembled = Data()
        for part in entry.parts { assembled.append(part ?? Data()) }
        pending.removeValue(forKey: frameId)
        let keyFrame = entry.flags & 0x01 != 0
        if waitingForKey && !keyFrame { return }
        if keyFrame { waitingForKey = false }
        lastEmitted = frameId
        onVideo?(assembled, keyFrame)
    }

    private func handleAudio(_ bytes: [UInt8]) {
        guard Llu2.u32(bytes, 5) == sessionId else { return }
        let seq = Llu2.u32(bytes, 9)
        let flags = Int(bytes[13])
        let expect = Llu2.u32(bytes, 14)
        var payload = Data(bytes[18...])
        if flags & 0x02 != 0 { Llu2.xor(&payload, key: key, frameId: seq, fragIdx: 0) }
        guard Llu2.crc32(payload) == expect else { return }
        onAudio?(payload)
    }

    private func pingLoop() {
        guard authed, !stopped else { return }
        var packet = Data("LLU2".utf8)
        packet.append(0x02)
        packet.append(contentsOf: Llu2.be32(sessionId))
        packet.append(contentsOf: Llu2.be64(UInt64(Date().timeIntervalSince1970 * 1000)))
        send(packet)
        queue.asyncAfter(deadline: .now() + 1) { [weak self] in self?.pingLoop() }
    }

    private func send(_ data: Data) {
        connection.send(content: data, completion: .contentProcessed { _ in })
    }
}

private struct Partial {
    var parts: [Data?]
    var flags = 0
    init(count: Int) { parts = Array(repeating: nil, count: count) }
}

private enum Llu2 {
    static func crc32(_ data: Data) -> UInt32 {
        var crc: UInt32 = 0xFFFF_FFFF
        for byte in data {
            crc ^= UInt32(byte)
            for _ in 0..<8 {
                let mask = (~(crc & 1)) &+ 1
                crc = (crc >> 1) ^ (0xEDB8_8320 & mask)
            }
        }
        return ~crc
    }

    static func key(_ token: String) -> Data {
        var out = [UInt8](repeating: 0, count: 16)
        let bytes = Array(token.utf8)
        for i in 0..<16 {
            var x = UInt8(truncatingIfNeeded: 0xA5 + i)
            for j in bytes.indices {
                let mixed = UInt8(truncatingIfNeeded: Int(bytes[j]) + i + j) &* 31
                x ^= mixed
                x = (x << 3) | (x >> 5)
            }
            out[i] = x
        }
        return Data(out)
    }

    static func xor(_ buf: inout Data, key: Data, frameId: UInt32, fragIdx: UInt16) {
        var ks = [UInt8](key)
        for i in ks.indices {
            var mix = UInt8(truncatingIfNeeded: frameId >> ((i % 4) * 8))
            mix = mix &+ UInt8(truncatingIfNeeded: fragIdx)
            mix = mix &+ UInt8(i)
            ks[i] ^= mix
        }
        for i in buf.indices {
            buf[i] ^= ks[i % 16]
        }
    }

    static func u32(_ bytes: [UInt8], _ offset: Int) -> UInt32 {
        (UInt32(bytes[offset]) << 24) | (UInt32(bytes[offset + 1]) << 16) | (UInt32(bytes[offset + 2]) << 8) | UInt32(bytes[offset + 3])
    }

    static func u16(_ bytes: [UInt8], _ offset: Int) -> UInt16 {
        (UInt16(bytes[offset]) << 8) | UInt16(bytes[offset + 1])
    }

    static func be32(_ value: UInt32) -> [UInt8] {
        [UInt8(value >> 24), UInt8(value >> 16), UInt8(value >> 8), UInt8(value)]
    }

    static func be64(_ value: UInt64) -> [UInt8] {
        (0..<8).map { UInt8((value >> ((7 - $0) * 8)) & 0xFF) }
    }
}

private final class AacQueue {
    private var queue: AudioQueueRef?
    private let rates: [Double] = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000]

    func enqueue(_ adts: Data) {
        guard adts.count > 7, adts[0] == 0xFF, adts[1] & 0xF0 == 0xF0 else { return }
        if queue == nil { start(adts) }
        guard let queue else { return }
        let header = (adts[1] & 0x01) == 0 ? 9 : 7
        guard adts.count > header else { return }
        let raw = adts.subdata(in: header..<adts.count)
        var buffer: AudioQueueBufferRef?
        guard AudioQueueAllocateBuffer(queue, UInt32(raw.count), &buffer) == noErr, let buffer else { return }
        raw.withUnsafeBytes { memcpy(buffer.pointee.mAudioData, $0.baseAddress!, raw.count) }
        buffer.pointee.mAudioDataByteSize = UInt32(raw.count)
        AudioQueueEnqueueBuffer(queue, buffer, 0, nil)
    }

    func stop() {
        if let queue {
            AudioQueueStop(queue, true)
            AudioQueueDispose(queue, true)
        }
        queue = nil
    }

    private func start(_ adts: Data) {
        let freqIndex = Int((adts[2] & 0x3C) >> 2)
        let profile = Int((adts[2] & 0xC0) >> 6)
        let channels = Int(((adts[2] & 0x01) << 2) | ((adts[3] & 0xC0) >> 6))
        var format = AudioStreamBasicDescription(
            mSampleRate: rates.indices.contains(freqIndex) ? rates[freqIndex] : 48000,
            mFormatID: kAudioFormatMPEG4AAC,
            mFormatFlags: 0,
            mBytesPerPacket: 0,
            mFramesPerPacket: 1024,
            mBytesPerFrame: 0,
            mChannelsPerFrame: UInt32(max(channels, 1)),
            mBitsPerChannel: 0,
            mReserved: 0
        )
        var created: AudioQueueRef?
        guard AudioQueueNewOutput(&format, { _, _, _ in }, nil, nil, nil, 0, &created) == noErr, let created else { return }
        var asc = Data([
            UInt8(((profile + 1) << 3) | (freqIndex >> 1)),
            UInt8(((freqIndex & 1) << 7) | (channels << 3)),
        ])
        asc.withUnsafeBytes { raw in
            AudioQueueSetProperty(created, kAudioQueueProperty_MagicCookie, raw.baseAddress!, UInt32(asc.count))
        }
        AudioQueueStart(created, nil)
        queue = created
    }
}
