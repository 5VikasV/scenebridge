package com.scenebridge.tv

import org.junit.Assert.*
import org.junit.Test

class PlaybackBoundaryTest {
    @Test fun evidenceReplayPreservesOriginalPause() {
        val b=PlaybackBoundary()
        b.capture(95000)
        assertEquals(27000L,b.replay(Evidence("p03",27000,35000,"earlier")))
        assertEquals(35000L,b.replayEndMs)
        assertEquals(95000L,b.returnToAnchor())
        assertNull(b.replayEndMs)
    }
    @Test(expected=IllegalArgumentException::class) fun rejectsFutureEvidence() {
        val b=PlaybackBoundary(); b.capture(95000)
        b.replay(Evidence("p13",147000,155000,"future"))
    }
    @Test fun rewindingCreatesAnEarlierBoundary() {
        val b=PlaybackBoundary(); b.capture(170000); b.close(); b.capture(30000)
        assertEquals(30000L,b.anchorMs)
        assertNull(b.replayEndMs)
    }
    @Test fun formatsTime() { assertEquals("02:35",formatTime(155000)) }
}
