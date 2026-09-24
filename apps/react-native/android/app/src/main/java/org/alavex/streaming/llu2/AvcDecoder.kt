package org.alavex.streaming.llu2

import android.media.MediaCodec
import android.media.MediaFormat
import android.os.Build
import android.view.Surface
import java.nio.ByteBuffer
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.atomic.AtomicBoolean

/** Annex-B H.264 → Surface via MediaCodec. */
internal class AvcDecoder(private val surface: Surface) {
    private val queue = ArrayBlockingQueue<ByteArray>(8)
    private val stop = AtomicBoolean(false)
    private var thread: Thread? = null

    fun start() {
        stop.set(false)
        thread = Thread({ run() }, "alavex-avc").also { it.start() }
    }

    fun stop() {
        stop.set(true)
        thread?.interrupt()
        queue.clear()
    }

    fun submit(frame: ByteArray, key: Boolean) {
        if (key) queue.clear()
        if (!queue.offer(frame) && key) {
            queue.clear()
            queue.offer(frame)
        }
    }

    private fun run() {
        var codec: MediaCodec? = null
        try {
            while (!stop.get()) {
                val frame = queue.poll(50, java.util.concurrent.TimeUnit.MILLISECONDS) ?: continue
                val nals = splitAnnexB(frame)
                val sps = nals.firstOrNull { it.isNotEmpty() && (it[0].toInt() and 0x1F) == 7 }
                val pps = nals.firstOrNull { it.isNotEmpty() && (it[0].toInt() and 0x1F) == 8 }
                if (codec == null) {
                    if (sps == null || pps == null) continue
                    codec = startCodec(sps, pps)
                }
                val vcl = nals.filter {
                    val t = if (it.isEmpty()) 0 else it[0].toInt() and 0x1F
                    t == 1 || t == 5
                }
                if (vcl.isEmpty()) continue
                val sample = toAvcc(vcl)
                val key = vcl.any { (it[0].toInt() and 0x1F) == 5 }
                val index = codec.dequeueInputBuffer(10_000)
                if (index < 0) continue
                val input = codec.getInputBuffer(index) ?: continue
                input.clear()
                input.put(sample)
                var flags = 0
                if (key) flags = flags or MediaCodec.BUFFER_FLAG_KEY_FRAME
                codec.queueInputBuffer(index, 0, sample.size, System.nanoTime() / 1000, flags)
                drain(codec)
            }
        } catch (_: InterruptedException) {
        } catch (_: Exception) {
        } finally {
            try {
                codec?.stop()
            } catch (_: Exception) {
            }
            codec?.release()
        }
    }

    private fun startCodec(sps: ByteArray, pps: ByteArray): MediaCodec {
        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, 1920, 1080)
        format.setByteBuffer("csd-0", ByteBuffer.wrap(sps))
        format.setByteBuffer("csd-1", ByteBuffer.wrap(pps))
        format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 2 * 1024 * 1024)
        if (Build.VERSION.SDK_INT >= 30) {
            format.setInteger(MediaFormat.KEY_LOW_LATENCY, 1)
        }
        val codec = MediaCodec.createDecoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        codec.configure(format, surface, null, 0)
        codec.start()
        return codec
    }

    private fun drain(codec: MediaCodec) {
        val info = MediaCodec.BufferInfo()
        while (true) {
            val index = codec.dequeueOutputBuffer(info, 0)
            if (index < 0) return
            codec.releaseOutputBuffer(index, true)
        }
    }

    private fun splitAnnexB(data: ByteArray): List<ByteArray> {
        val starts = ArrayList<Int>()
        var i = 0
        while (i + 3 < data.size) {
            if (data[i].toInt() == 0 && data[i + 1].toInt() == 0) {
                if (data[i + 2].toInt() == 1) {
                    starts.add(i + 3)
                    i += 3
                    continue
                }
                if (i + 3 < data.size && data[i + 2].toInt() == 0 && data[i + 3].toInt() == 1) {
                    starts.add(i + 4)
                    i += 4
                    continue
                }
            }
            i += 1
        }
        val out = ArrayList<ByteArray>(starts.size)
        for (n in starts.indices) {
            val from = starts[n]
            val to = if (n + 1 < starts.size) {
                var end = starts[n + 1]
                while (end > from && data[end - 1].toInt() == 0) end -= 1
                end
            } else {
                data.size
            }
            if (to > from) out.add(data.copyOfRange(from, to))
        }
        return out
    }

    private fun toAvcc(nals: List<ByteArray>): ByteArray {
        var total = 0
        for (nal in nals) total += 4 + nal.size
        val out = ByteArray(total)
        var offset = 0
        for (nal in nals) {
            val len = nal.size
            out[offset++] = (len ushr 24).toByte()
            out[offset++] = (len ushr 16).toByte()
            out[offset++] = (len ushr 8).toByte()
            out[offset++] = len.toByte()
            nal.copyInto(out, offset)
            offset += nal.size
        }
        return out
    }
}
