package org.alavex.streaming.llu2

import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.media.MediaCodec
import android.media.MediaFormat
import java.nio.ByteBuffer

/** AAC ADTS frames from the host → PCM AudioTrack. */
internal class AacPlayer {
    private var codec: MediaCodec? = null
    private var track: AudioTrack? = null
    private val rates = intArrayOf(96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000)

    @Synchronized
    fun play(adts: ByteArray) {
        try {
            playFrame(adts)
        } catch (_: Exception) {
        }
    }

    private fun playFrame(adts: ByteArray) {
        if (adts.size < 8) return
        if (adts[0] != 0xFF.toByte() || (adts[1].toInt() and 0xF0) != 0xF0) return
        val freqIndex = (adts[2].toInt() and 0x3C) ushr 2
        val profile = (adts[2].toInt() and 0xC0) ushr 6
        val channels = ((adts[2].toInt() and 0x01) shl 2) or ((adts[3].toInt() and 0xC0) ushr 6)
        if (codec == null) {
            val sampleRate = rates.getOrElse(freqIndex) { 48000 }
            val asc = byteArrayOf(
                (((profile + 1) shl 3) or (freqIndex ushr 1)).toByte(),
                (((freqIndex and 1) shl 7) or (channels shl 3)).toByte(),
            )
            val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, channels.coerceAtLeast(1))
            format.setByteBuffer("csd-0", ByteBuffer.wrap(asc))
            format.setInteger(MediaFormat.KEY_IS_ADTS, 0)
            val created = MediaCodec.createDecoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
            created.configure(format, null, null, 0)
            created.start()
            codec = created
            val channelMask = if (channels > 1) AudioFormat.CHANNEL_OUT_STEREO else AudioFormat.CHANNEL_OUT_MONO
            val min = AudioTrack.getMinBufferSize(sampleRate, channelMask, AudioFormat.ENCODING_PCM_16BIT)
            track = AudioTrack(
                AudioManager.STREAM_MUSIC,
                sampleRate,
                channelMask,
                AudioFormat.ENCODING_PCM_16BIT,
                min.coerceAtLeast(sampleRate),
                AudioTrack.MODE_STREAM,
            ).also { it.play() }
        }
        val header = if ((adts[1].toInt() and 0x01) == 0) 9 else 7
        if (adts.size <= header) return
        val raw = adts.copyOfRange(header, adts.size)
        val decoder = codec ?: return
        val index = decoder.dequeueInputBuffer(5_000)
        if (index < 0) return
        decoder.getInputBuffer(index)?.let {
            it.clear()
            it.put(raw)
        }
        decoder.queueInputBuffer(index, 0, raw.size, 0, 0)
        val info = MediaCodec.BufferInfo()
        while (true) {
            val out = decoder.dequeueOutputBuffer(info, 0)
            if (out < 0) break
            val pcm = decoder.getOutputBuffer(out)
            if (pcm != null && info.size > 0) {
                val bytes = ByteArray(info.size)
                pcm.position(info.offset)
                pcm.get(bytes)
                track?.write(bytes, 0, bytes.size)
            }
            decoder.releaseOutputBuffer(out, false)
        }
    }

    @Synchronized
    fun stop() {
        try {
            codec?.stop()
        } catch (_: Exception) {
        }
        codec?.release()
        codec = null
        track?.stop()
        track?.release()
        track = null
    }
}
