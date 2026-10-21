@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)

package com.scenebridge.tv

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.isEnabled
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.semantics.SemanticsActions
import androidx.test.platform.app.InstrumentationRegistry
import android.graphics.Bitmap
import java.io.File
import org.junit.Rule
import org.junit.Test

class PlayerFlowTest {
    @get:Rule val ui=createAndroidComposeRule<MainActivity>()
    private fun click(label: String) {
        ui.onNodeWithText(label).performSemanticsAction(SemanticsActions.OnClick) { it() }
    }
    private fun capture(name: String) {
        ui.waitForIdle()
        if (InstrumentationRegistry.getArguments().getString("recording") == "true") Thread.sleep(2500)
        val instrumentation=InstrumentationRegistry.getInstrumentation()
        val bitmap=instrumentation.uiAutomation.takeScreenshot()
        val file=File(instrumentation.targetContext.filesDir,name)
        file.outputStream().use {
            bitmap.compress(Bitmap.CompressFormat.PNG,100,it)
        }
        bitmap.recycle()
    }
    @Test fun remoteActionsOpenAndCloseBoundedContext() {
        ui.waitUntil(timeoutMillis=20000) {
            ui.onAllNodes(hasText("+10s") and isEnabled()).fetchSemanticsNodes().isNotEmpty()
        }
        ui.onNodeWithText("Retry connection").assertDoesNotExist()
        ui.onNodeWithText("Stay in\nthe story.").assertIsDisplayed()
        ui.onNodeWithText("↶  Recap last minute").performSemanticsAction(SemanticsActions.RequestFocus) { it() }
        ui.onRoot().performKeyInput { pressKey(Key.DirectionCenter) }
        ui.onNodeWithText("Here's the thread.").performScrollTo().assertIsDisplayed()
        click("▶  Back to the story")
        ui.onNodeWithText("Stay in\nthe story.").performScrollTo().assertIsDisplayed()
    }

    @Test fun questionIsWithheldBeforeRevealAndAnsweredAfterward() {
        ui.waitUntil(timeoutMillis=20000) {
            ui.onAllNodes(hasText("+10s") and isEnabled()).fetchSemanticsNodes().isNotEmpty()
        }
        ui.onNodeWithText("Retry connection").assertDoesNotExist()
        // Start from a clean app state supplied by the test runner.
        repeat(9) { click("+10s") }
        click("⌨  Ask a question")
        capture("tv-question-dialog.png")
        ui.waitUntil(5000) { ui.onAllNodes(hasSetTextAction()).fetchSemanticsNodes().isNotEmpty() }
        ui.onNode(hasSetTextAction()).performTextInput("Why did Mira hide the key?")
        click("Ask SceneBridge")
        ui.waitUntil(timeoutMillis=15000) {
            ui.onAllNodes(hasText("NOT ESTABLISHED YET")).fetchSemanticsNodes().isNotEmpty()
        }
        capture("tv-before-reveal.png")
        click("▶  Back to the story")
        repeat(7) { click("+10s") }
        click("⌨  Ask a question")
        ui.waitUntil(5000) { ui.onAllNodes(hasSetTextAction()).fetchSemanticsNodes().isNotEmpty() }
        ui.onNode(hasSetTextAction()).performTextInput("Why did Mira hide the key?")
        click("Ask SceneBridge")
        ui.waitUntil(timeoutMillis=15000) {
            ui.onAllNodes(hasText("HERE'S THE CONTEXT")).fetchSemanticsNodes().isNotEmpty()
        }
        ui.onNodeWithText("HERE'S THE CONTEXT").performScrollTo().assertIsDisplayed()
        capture("tv-after-reveal.png")
        click("▶  02:27 — 02:35")
        ui.waitUntil(timeoutMillis=15000) {
            ui.onAllNodes(hasText("Ⅱ Pause")).fetchSemanticsNodes().isNotEmpty()
        }
        ui.onNodeWithText("Retry connection").assertDoesNotExist()
        capture("tv-evidence-replay.png")
        click("▶  Back to the story")
        ui.onNodeWithText("Stay in\nthe story.").performScrollTo().assertIsDisplayed()
        capture("tv-resumed.png")
    }
}
