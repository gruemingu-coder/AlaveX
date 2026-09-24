package org.alavex.streaming.llu2

import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.concurrent.atomic.AtomicBoolean

/**
 * UDP LLU2 client. Assembles H.264 Annex-B frames and AAC ADTS packets
 * the same way `src-tauri/src/media_client.rs` does.
 */
internal class Llu2Client(
    private val host: String,
    private val port: Int,
    private val credential: String,
    private val listener: Listener,
) {
    interface Listener {
        fun onVideo(frame: ByteArray, key: Boolean)
        fun onAudio(adts: ByteArray)
        fun onStats(rttMs: Int, lossPct: Float)
        fun onError(message: String)
    }

    private val stop = AtomicBoolean(false)
    private var thread: Thread? = null

    fun start() {
        stop.set(false)
        thread = Thread({ run() }, "alavex-llu2").also { it.start() }
    }

    fun stop() {
        stop.set(true)
        thread?.interrupt()
        thread = null
    }

    private class Partial(
        val fragCnt: Int,
        val parts: Array<ByteArray?>,
        var received: Int,
        var flags: Int,
        val startedMs: Long,
    )

    private fun run() {
        val socket = try {
            DatagramSocket().also {
                it.soTimeout = 100
                it.connect(InetAddress.getByName(host), port)
            }
        } catch (err: Exception) {
            listener.onError("UDP 연결 실패: ${err.message}")
            return
        }
        try {
            val key = Llu2Protocol.deriveStreamKey(credential)
            val auth = Llu2Protocol.MAGIC + byteArrayOf(Llu2Protocol.TYPE_AUTH) + credential.toByteArray(Charsets.UTF_8)
            socket.send(DatagramPacket(auth, auth.size))
            val buf = ByteArray(2048)
            val packet = DatagramPacket(buf, buf.size)
            val authDeadline = System.currentTimeMillis() + 5000
            var sessionId = 0
            var authed = false
            while (System.currentTimeMillis() < authDeadline && !stop.get()) {
                try {
                    packet.length = buf.size
                    socket.receive(packet)
                    val n = packet.length
                    if (n >= 5 && buf.copyOfRange(0, 4).contentEquals(Llu2Protocol.MAGIC)) {
                        when (buf[4]) {
                            Llu2Protocol.TYPE_AUTH_OK -> if (n >= 15) {
                                sessionId = Llu2Protocol.u32(buf, 5)
                                authed = true
                                break
                            }
                            Llu2Protocol.TYPE_AUTH_FAIL -> {
                                listener.onError("미디어 인증에 실패했습니다. PIN을 확인하세요.")
                                return
                            }
                        }
                    }
                } catch (_: java.net.SocketTimeoutException) {
                    socket.send(DatagramPacket(auth, auth.size))
                }
            }
            if (!authed) {
                listener.onError("호스트 미디어 포트(UDP 47998) 응답이 없습니다. 같은 Wi-Fi인지 확인하세요.")
                return
            }

            val pending = HashMap<Int, Partial>()
            var lastPing = 0L
            var lastPli = 0L
            var lastEmitted = 0
            var waitingForKey = true
            var rttMs = 0
            var framesOk = 0L
            var framesLost = 0L
            var lastStats = System.currentTimeMillis()

            while (!stop.get()) {
                val now = System.currentTimeMillis()
                if (now - lastPing > 1000) {
                    val ping = ByteArray(17)
                    Llu2Protocol.MAGIC.copyInto(ping)
                    ping[4] = Llu2Protocol.TYPE_PING
                    Llu2Protocol.putU32(ping, 5, sessionId)
                    Llu2Protocol.putU64(ping, 9, now)
                    socket.send(DatagramPacket(ping, ping.size))
                    lastPing = now
                }
                var needPli = false
                val stale = ArrayList<Int>()
                for ((fid, frame) in pending) {
                    val age = now - frame.startedMs
                    if (age in 80..499) {
                        frame.parts.forEachIndexed { idx, part ->
                            if (part == null) sendNack(socket, sessionId, fid, idx)
                        }
                    }
                    if (age > 250) needPli = true
                    if (age > 500) stale.add(fid)
                }
                stale.forEach { pending.remove(it) }
                if (pending.size > 16) {
                    pending.clear()
                    needPli = true
                }
                if (needPli && now - lastPli > 400) {
                    sendPli(socket, sessionId)
                    lastPli = now
                    waitingForKey = true
                    pending.clear()
                    framesLost += 1
                }
                if (now - lastStats > 1000) {
                    val total = framesOk + framesLost
                    val loss = if (total == 0L) 0f else (framesLost * 1000L / total) / 10f
                    listener.onStats(rttMs, loss)
                    lastStats = now
                }

                try {
                    packet.length = buf.size
                    socket.receive(packet)
                } catch (_: java.net.SocketTimeoutException) {
                    continue
                }
                val n = packet.length
                if (n < 5 || !buf.copyOfRange(0, 4).contentEquals(Llu2Protocol.MAGIC)) continue
                val type = buf[4]
                if (type == Llu2Protocol.TYPE_PONG && n >= 17) {
                    if (Llu2Protocol.u32(buf, 5) == sessionId) {
                        val sent = readU64(buf, 9)
                        rttMs = (now - sent).coerceAtLeast(0).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
                    }
                    continue
                }
                if (type == Llu2Protocol.TYPE_AUDIO && n >= Llu2Protocol.AUDIO_HEADER_LEN) {
                    if (Llu2Protocol.u32(buf, 5) != sessionId) continue
                    val seq = Llu2Protocol.u32(buf, 9)
                    val flags = buf[13].toInt() and 0xFF
                    val expect = Llu2Protocol.u32(buf, 14)
                    val payload = buf.copyOfRange(Llu2Protocol.AUDIO_HEADER_LEN, n)
                    if (flags and Llu2Protocol.FLAG_ENC != 0) {
                        Llu2Protocol.xorPayload(payload, key, seq, 0)
                    }
                    if (Llu2Protocol.crc32(payload) != expect) continue
                    listener.onAudio(payload)
                    continue
                }
                if (type != Llu2Protocol.TYPE_VIDEO || n < Llu2Protocol.VIDEO_HEADER_LEN) continue
                if (Llu2Protocol.u32(buf, 5) != sessionId) continue
                val frameId = Llu2Protocol.u32(buf, 9)
                val fragIdx = Llu2Protocol.u16(buf, 13)
                val fragCnt = Llu2Protocol.u16(buf, 15)
                val flags = buf[17].toInt() and 0xFF
                val expect = Llu2Protocol.u32(buf, 18)
                if (fragCnt == 0 || fragIdx >= fragCnt || fragCnt > 4096) continue
                val payload = buf.copyOfRange(Llu2Protocol.VIDEO_HEADER_LEN, n)
                if (flags and Llu2Protocol.FLAG_ENC != 0) {
                    Llu2Protocol.xorPayload(payload, key, frameId, fragIdx)
                }
                if (Llu2Protocol.crc32(payload) != expect) {
                    sendNack(socket, sessionId, frameId, fragIdx)
                    continue
                }
                if (lastEmitted != 0 && frameId > lastEmitted + 1 && now - lastPli > 400) {
                    framesLost += (frameId - lastEmitted - 1).toLong()
                    sendPli(socket, sessionId)
                    lastPli = now
                    waitingForKey = true
                    pending.clear()
                }
                val isKey = flags and Llu2Protocol.FLAG_KEY != 0
                if (waitingForKey && !isKey) continue
                val entry = pending.getOrPut(frameId) {
                    Partial(fragCnt, arrayOfNulls(fragCnt), 0, flags, now)
                }
                if (entry.fragCnt != fragCnt) continue
                if (entry.parts[fragIdx] == null) {
                    entry.parts[fragIdx] = payload
                    entry.received += 1
                    entry.flags = entry.flags or flags
                }
                if (entry.received != entry.fragCnt) continue
                var size = 0
                for (part in entry.parts) size += part?.size ?: 0
                val assembled = ByteArray(size)
                var offset = 0
                var ok = true
                for (part in entry.parts) {
                    if (part == null) {
                        ok = false
                        break
                    }
                    part.copyInto(assembled, offset)
                    offset += part.size
                }
                val frameFlags = entry.flags
                pending.remove(frameId)
                if (!ok || assembled.isEmpty() || assembled.size > 8 * 1024 * 1024) continue
                val keyFrame = frameFlags and Llu2Protocol.FLAG_KEY != 0
                if (waitingForKey && !keyFrame) continue
                if (keyFrame) waitingForKey = false
                lastEmitted = frameId
                framesOk += 1
                listener.onVideo(assembled, keyFrame)
            }
        } catch (err: Exception) {
            if (!stop.get()) listener.onError(err.message ?: "미디어 수신 오류")
        } finally {
            socket.close()
        }
    }

    private fun readU64(buf: ByteArray, offset: Int): Long {
        var v = 0L
        for (i in 0 until 8) {
            v = (v shl 8) or (buf[offset + i].toLong() and 0xFF)
        }
        return v
    }

    private fun sendNack(socket: DatagramSocket, sessionId: Int, frameId: Int, fragIdx: Int) {
        val pkt = ByteArray(15)
        Llu2Protocol.MAGIC.copyInto(pkt)
        pkt[4] = Llu2Protocol.TYPE_NACK
        Llu2Protocol.putU32(pkt, 5, sessionId)
        Llu2Protocol.putU32(pkt, 9, frameId)
        Llu2Protocol.putU16(pkt, 13, fragIdx)
        socket.send(DatagramPacket(pkt, pkt.size))
    }

    private fun sendPli(socket: DatagramSocket, sessionId: Int) {
        val pkt = ByteArray(9)
        Llu2Protocol.MAGIC.copyInto(pkt)
        pkt[4] = Llu2Protocol.TYPE_PLI
        Llu2Protocol.putU32(pkt, 5, sessionId)
        socket.send(DatagramPacket(pkt, pkt.size))
    }
}
