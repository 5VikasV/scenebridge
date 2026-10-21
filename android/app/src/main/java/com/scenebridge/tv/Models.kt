package com.scenebridge.tv

data class Film(val id: String, val title: String, val subtitle: String, val durationMs: Long,
                val mediaUrl: String, val captionsUrl: String, val mode: String)
data class Evidence(val id: String, val startMs: Long, val endMs: Long, val text: String)
data class Answer(val text: String, val status: String, val cutoffMs: Long, val citations: List<Evidence>, val mode: String)

fun formatTime(ms: Long): String {
    val seconds = ms.coerceAtLeast(0) / 1000
    return "%02d:%02d".format(seconds / 60, seconds % 60)
}

/** Pure playback state keeps replay and original question boundaries separate. */
class PlaybackBoundary {
    var anchorMs: Long? = null
        private set
    var replayEndMs: Long? = null
        private set
    fun capture(positionMs: Long) { anchorMs = positionMs; replayEndMs = null }
    fun replay(evidence: Evidence): Long {
        val cutoff = requireNotNull(anchorMs)
        require(evidence.startMs >= 0 && evidence.endMs > evidence.startMs && evidence.endMs <= cutoff)
        replayEndMs = evidence.endMs
        return evidence.startMs
    }
    fun returnToAnchor(): Long = requireNotNull(anchorMs).also { replayEndMs = null }
    fun close() { anchorMs = null; replayEndMs = null }
}
