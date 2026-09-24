package org.alavex.streaming.llu2

/** Wire helpers matching `src-tauri/src/media_client.rs`. */
internal object Llu2Protocol {
    val MAGIC = byteArrayOf('L'.code.toByte(), 'L'.code.toByte(), 'U'.code.toByte(), '2'.code.toByte())
    const val TYPE_AUTH: Byte = 0x01
    const val TYPE_PING: Byte = 0x02
    const val TYPE_NACK: Byte = 0x03
    const val TYPE_PLI: Byte = 0x04
    const val TYPE_AUTH_OK: Byte = 0x81.toByte()
    const val TYPE_AUTH_FAIL: Byte = 0x82.toByte()
    const val TYPE_PONG: Byte = 0x85.toByte()
    const val TYPE_VIDEO: Byte = 0x10
    const val TYPE_AUDIO: Byte = 0x11
    const val FLAG_KEY: Int = 0x01
    const val FLAG_ENC: Int = 0x02
    const val VIDEO_HEADER_LEN = 22
    const val AUDIO_HEADER_LEN = 18

    fun crc32(data: ByteArray): Int {
        var crc = 0xFFFFFFFF.toInt()
        for (raw in data) {
            crc = crc xor (raw.toInt() and 0xFF)
            repeat(8) {
                val mask = (crc and 1).inv() + 1
                crc = (crc ushr 1) xor (0xEDB88320.toInt() and mask)
            }
        }
        return crc.inv()
    }

    fun deriveStreamKey(token: String): ByteArray {
        val out = ByteArray(16)
        val bytes = token.toByteArray(Charsets.UTF_8)
        for (i in out.indices) {
            var x = (0xA5 + i) and 0xFF
            for (j in bytes.indices) {
                val tb = bytes[j].toInt() and 0xFF
                val mixed = ((tb + i + j) and 0xFF) * 31
                x = x xor (mixed and 0xFF)
                x = ((x shl 3) or (x ushr 5)) and 0xFF
            }
            out[i] = x.toByte()
        }
        return out
    }

    fun xorPayload(buf: ByteArray, key: ByteArray, frameId: Int, fragIdx: Int) {
        val ks = key.copyOf()
        for (i in ks.indices) {
            var mix = (frameId ushr ((i % 4) * 8)) and 0xFF
            mix = (mix + (fragIdx and 0xFF)) and 0xFF
            mix = (mix + i) and 0xFF
            ks[i] = (ks[i].toInt() xor mix).toByte()
        }
        for (i in buf.indices) {
            buf[i] = (buf[i].toInt() xor (ks[i % 16].toInt() and 0xFF)).toByte()
        }
    }

    fun u32(buf: ByteArray, offset: Int): Int {
        return ((buf[offset].toInt() and 0xFF) shl 24) or
            ((buf[offset + 1].toInt() and 0xFF) shl 16) or
            ((buf[offset + 2].toInt() and 0xFF) shl 8) or
            (buf[offset + 3].toInt() and 0xFF)
    }

    fun u16(buf: ByteArray, offset: Int): Int {
        return ((buf[offset].toInt() and 0xFF) shl 8) or (buf[offset + 1].toInt() and 0xFF)
    }

    fun putU32(out: ByteArray, offset: Int, value: Int) {
        out[offset] = (value ushr 24).toByte()
        out[offset + 1] = (value ushr 16).toByte()
        out[offset + 2] = (value ushr 8).toByte()
        out[offset + 3] = value.toByte()
    }

    fun putU16(out: ByteArray, offset: Int, value: Int) {
        out[offset] = (value ushr 8).toByte()
        out[offset + 1] = value.toByte()
    }

    fun putU64(out: ByteArray, offset: Int, value: Long) {
        for (i in 0 until 8) {
            out[offset + i] = (value ushr ((7 - i) * 8)).toByte()
        }
    }
}
