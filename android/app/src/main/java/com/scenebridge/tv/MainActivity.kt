@file:OptIn(androidx.tv.material3.ExperimentalTvMaterial3Api::class)

package com.scenebridge.tv

import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.tv.material3.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers

private val Ink=Color(0xFF080F1A)
private val Panel=Color(0xFF111E2C)
private val Teal=Color(0xFF80D9CB)
private val Muted=Color(0xFF9AACBA)
private val White=Color(0xFFEDF4F5)
private val Gold=Color(0xFFE2BD7F)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContent {
            MaterialTheme(colorScheme=darkColorScheme(primary=Teal,background=Ink,surface=Panel,onSurface=White)) {
                SceneBridgeScreen(this)
            }
        }
    }
}

@Composable
private fun SceneBridgeScreen(activity: MainActivity) {
    val context=LocalContext.current
    val prefs=remember { context.getSharedPreferences("scenebridge",0) }
    val scope=rememberCoroutineScope()
    val player=remember { ExoPlayer.Builder(context).build() }
    val boundary=remember { PlaybackBoundary() }
    var baseUrl by remember { mutableStateOf(prefs.getString("api_url",BuildConfig.DEFAULT_API_URL)!!) }
    var film by remember { mutableStateOf<Film?>(null) }
    var loading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var playbackError by remember { mutableStateOf<String?>(null) }
    var position by remember { mutableLongStateOf(0) }
    var playing by remember { mutableStateOf(false) }
    var question by remember { mutableStateOf("") }
    var answer by remember { mutableStateOf<Answer?>(null) }
    var answerError by remember { mutableStateOf<String?>(null) }
    var answering by remember { mutableStateOf(false) }
    var requestJob by remember { mutableStateOf<Job?>(null) }
    var generation by remember { mutableIntStateOf(0) }
    var questionDialog by remember { mutableStateOf(false) }
    var settingsDialog by remember { mutableStateOf(false) }
    var settingsError by remember { mutableStateOf<String?>(null) }
    var replaying by remember { mutableStateOf(false) }
    var loadGeneration by remember { mutableIntStateOf(0) }
    var pausedAt by remember { mutableStateOf<Long?>(null) }

    fun savePosition() {
        val id=film?.id ?: return
        prefs.edit().putLong("position_$id",boundary.anchorMs ?: player.currentPosition).apply()
    }
    fun closeAnswer(resume: Boolean) {
        generation++; requestJob?.cancel(); answering=false
        if (boundary.anchorMs != null) player.seekTo(boundary.returnToAnchor())
        boundary.close(); pausedAt=null; replaying=false
        answer=null; answerError=null; question=""
        if (resume) player.play() else player.pause()
    }
    fun ask(text: String) {
        val current=film ?: return
        val cutoff=boundary.anchorMs ?: player.currentPosition.coerceIn(0,current.durationMs)
        if (boundary.anchorMs == null) boundary.capture(cutoff)
        if (replaying) player.seekTo(boundary.returnToAnchor())
        player.pause(); replaying=false; pausedAt=cutoff
        generation++; val ticket=generation
        requestJob?.cancel(); answer=null; answerError=null; question=text; answering=true
        requestJob=scope.launch {
            try {
                val result=SceneBridgeApi(baseUrl).ask(current,cutoff,text)
                if (ticket == generation && boundary.anchorMs == cutoff) answer=result
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) {
                if (ticket == generation) answerError=error.message ?: "Couldn't get an answer. Please retry."
            } finally { if (ticket == generation) answering=false }
        }
    }
    fun seek(delta: Long) {
        val old=boundary.anchorMs ?: player.currentPosition
        closeAnswer(false)
        player.seekTo((old+delta).coerceIn(0,film?.durationMs ?: 0))
    }
    fun openQuestion() {
        val current=film ?: return
        if (boundary.anchorMs==null) boundary.capture(player.currentPosition.coerceIn(0,current.durationMs))
        if (replaying) player.seekTo(boundary.returnToAnchor())
        player.pause(); replaying=false; pausedAt=boundary.anchorMs
        questionDialog=true
    }

    LaunchedEffect(baseUrl,loadGeneration) {
        loading=true; loadError=null; playbackError=null
        try {
            val loaded=SceneBridgeApi(baseUrl).catalog()
            // ExoPlayer belongs to the Android main looper. Explicit dispatch also
            // keeps instrumentation/recomposer test dispatchers from touching it off-thread.
            withContext(Dispatchers.Main.immediate) {
                val old=film
                val resume=if (old?.id == loaded.id) player.currentPosition else prefs.getLong("position_${loaded.id}",0)
                val subtitles=MediaItem.SubtitleConfiguration.Builder(android.net.Uri.parse(loaded.captionsUrl))
                    .setMimeType(MimeTypes.TEXT_VTT).setLanguage("en").setSelectionFlags(C.SELECTION_FLAG_DEFAULT).build()
                player.setMediaItem(MediaItem.Builder().setUri(loaded.mediaUrl).setSubtitleConfigurations(listOf(subtitles)).build())
                player.prepare(); player.seekTo(resume.coerceIn(0,loaded.durationMs)); player.pause()
                film=loaded
            }
        } catch (error: CancellationException) { throw error }
        catch (error: Exception) {
            Log.e("SceneBridge","Catalog or player setup failed",error)
            loadError="Couldn't open the film. Check the SceneBridge server address and retry."
        }
        finally { loading=false }
    }
    DisposableEffect(player) {
        val listener=object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) { playing=isPlaying }
            override fun onPlayerError(error: PlaybackException) {
                playbackError="Video unavailable. Check the server or refresh its media link."
            }
        }
        val observer=LifecycleEventObserver { _,event ->
            if (event==Lifecycle.Event.ON_STOP) { savePosition(); player.pause() }
        }
        player.addListener(listener); activity.lifecycle.addObserver(observer)
        onDispose { savePosition(); player.removeListener(listener); activity.lifecycle.removeObserver(observer); player.release() }
    }
    LaunchedEffect(player) {
        withContext(Dispatchers.Main.immediate) {
            var ticks=0
            while(true) {
                position=player.currentPosition
                val end=boundary.replayEndMs
                if (end != null && position >= end) {
                    player.pause(); player.seekTo(end)
                }
                if (++ticks % 20 == 0) savePosition()
                delay(100)
            }
        }
    }
    BackHandler(enabled=pausedAt!=null) { closeAnswer(false) }

    Column(Modifier.fillMaxSize().background(Ink).padding(horizontal=28.dp,vertical=20.dp)) {
        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
            Logo()
            Text("scene",color=White,fontSize=24.sp,fontWeight=FontWeight.Bold)
            Text("bridge",color=Teal,fontSize=24.sp,fontWeight=FontWeight.Light,modifier=Modifier.offset(x=(-10).dp))
            Spacer(Modifier.weight(1f))
            Text(if(film?.mode=="aws") "●  AWS · BEDROCK" else "●  OFFLINE FIXTURE",color=if(film?.mode=="aws") Teal else Gold,fontSize=11.sp)
            ActionButton("Server") { settingsError=null; settingsDialog=true }
        }
        Spacer(Modifier.height(20.dp))
        Row(Modifier.fillMaxWidth().weight(1f),horizontalArrangement=Arrangement.spacedBy(24.dp)) {
            Column(Modifier.weight(1.55f).fillMaxHeight(),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                Box(Modifier.fillMaxWidth().weight(1f).clip(RoundedCornerShape(12.dp)).background(Color.Black)
                    .border(1.dp,Color(0xFF293A48),RoundedCornerShape(12.dp)),contentAlignment=Alignment.Center) {
                    AndroidView(factory={ PlayerView(it).apply { this.player=player; useController=false; isFocusable=false } },modifier=Modifier.fillMaxSize())
                    if (loading || loadError!=null || playbackError!=null) {
                        Column(Modifier.fillMaxSize().background(Ink.copy(alpha=.94f)).padding(24.dp),verticalArrangement=Arrangement.Center,horizontalAlignment=Alignment.CenterHorizontally) {
                            Text(if(loading) "Opening the projection room…" else loadError ?: playbackError ?: "",color=White,fontSize=17.sp)
                            if(!loading) {
                                Spacer(Modifier.height(12.dp))
                                ActionButton("Retry connection") { loadGeneration++ }
                            }
                        }
                    }
                    if(replaying) Text("EARLIER SCENE · ${formatTime(position)}",color=Ink,fontSize=11.sp,
                        modifier=Modifier.align(Alignment.TopStart).padding(12.dp).background(Teal,RoundedCornerShape(4.dp)).padding(8.dp))
                }
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
                    Text(formatTime(position),color=White,fontSize=12.sp)
                    Text(if(replaying) "EVIDENCE REPLAY" else if(playing) "NOW PLAYING" else "PAUSED",color=Muted,fontSize=11.sp)
                    Text(formatTime(film?.durationMs ?: 180000),color=Muted,fontSize=12.sp)
                }
                Canvas(Modifier.fillMaxWidth().height(3.dp)) {
                    drawRect(Color(0xFF293A48))
                    drawRect(Teal,size=androidx.compose.ui.geometry.Size(size.width*(position.toFloat()/(film?.durationMs ?: 180000).coerceAtLeast(1)).coerceIn(0f,1f),size.height))
                }
                Row(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalAlignment=Alignment.CenterVertically) {
                    ActionButton(if(playing) "Ⅱ Pause" else "▶ Play",enabled=film!=null && !loading) {
                        if(pausedAt!=null) closeAnswer(true)
                        else if(player.isPlaying) player.pause() else {
                            if(player.playbackState==Player.STATE_ENDED) player.seekTo(0)
                            player.play()
                        }
                    }
                    ActionButton("−10s",enabled=film!=null) { seek(-10000) }
                    ActionButton("+10s",enabled=film!=null) { seek(10000) }
                    if(pausedAt!=null) ActionButton("Return · ${formatTime(pausedAt!!)}") { closeAnswer(false) }
                }
                Spacer(Modifier.height(2.dp))
                Text(film?.title ?: "The Last Screening",color=White,fontSize=22.sp,fontWeight=FontWeight.SemiBold)
                Text(film?.subtitle ?: "Your story is waiting.",color=Muted,fontSize=12.sp)
            }
            Column(Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(14.dp)).background(Panel)
                .padding(20.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(13.dp)) {
                Text("YOUR VIEWING COMPANION",color=Teal,fontSize=10.sp,fontWeight=FontWeight.Bold,letterSpacing=1.5.sp)
                Text(if(pausedAt==null) "Stay in\nthe story." else "Here's the thread.",color=White,fontSize=if(pausedAt==null) 27.sp else 23.sp,fontWeight=FontWeight.SemiBold,lineHeight=32.sp)
                Text(if(pausedAt==null) "Missed a moment? Ask about what you've watched, then pick up right where you left off."
                    else "Answers bounded to ${formatTime(pausedAt!!)}. Later passages are withheld.",color=Muted,fontSize=13.sp,lineHeight=19.sp)
                if(film?.mode!="aws" && pausedAt==null) Text("OFFLINE DEMO · Extracted transcript passages. No AI or AWS calls.",color=Gold,fontSize=10.sp,lineHeight=15.sp)
                if(pausedAt==null || (!answering && answer==null && answerError==null)) {
                    ActionButton("↶  Recap last minute",enabled=film!=null && !loading,wide=true) { ask("Recap the last minute of completed scenes.") }
                    ActionButton("✧  Explain this scene",enabled=film!=null && !loading,wide=true) { ask("Explain the most recent scene using only what has already been established.") }
                    ActionButton("⌨  Ask a question",enabled=film!=null && !loading,wide=true) { openQuestion() }
                }
                if(question.isNotBlank()) {
                    Text("YOU ASKED",color=Muted,fontSize=10.sp)
                    Text(question,color=White,fontSize=14.sp,fontWeight=FontWeight.Medium)
                }
                if(answering) Text("Looking through earlier moments…",color=Teal,fontSize=14.sp)
                answerError?.let {
                    Text(it,color=Gold,fontSize=13.sp)
                    ActionButton("Retry answer") { ask(question) }
                }
                answer?.let { result ->
                    Text(if(result.status=="answered") "HERE'S THE CONTEXT" else "NOT ESTABLISHED YET",color=Teal,fontSize=10.sp)
                    Text(result.text,color=White,fontSize=14.sp,lineHeight=21.sp)
                    for(c in result.citations) {
                        Button(onClick={
                            player.seekTo(boundary.replay(c)); player.play(); replaying=true
                        },modifier=Modifier.fillMaxWidth(),colors=ButtonDefaults.colors(containerColor=Color(0xFF1B3040),focusedContainerColor=Teal,contentColor=White,focusedContentColor=Ink)) {
                            Column(verticalArrangement=Arrangement.spacedBy(4.dp)) {
                                Text("▶  ${formatTime(c.startMs)} — ${formatTime(c.endMs)}",fontSize=12.sp,fontWeight=FontWeight.Bold)
                                Text(c.text,fontSize=11.sp,lineHeight=16.sp,maxLines=3)
                            }
                        }
                    }
                }
                if(pausedAt!=null) {
                    ActionButton("▶  Back to the story",wide=true) { closeAnswer(true) }
                    if(!answering && (answer!=null || answerError!=null)) ActionButton("Ask something else",wide=true) { openQuestion() }
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
            Text("WATCH. WONDER. PICK UP WHERE YOU LEFT OFF.",color=Muted,fontSize=8.sp,letterSpacing=1.sp)
            Text("D-pad to navigate  ·  Select to choose  ·  Back to return",color=Muted,fontSize=9.sp)
        }
    }
    if(questionDialog) InputDialog("What would you like to know?","Why did Mira hide the key?", "Ask SceneBridge",question.takeIf { !it.startsWith("Recap") && !it.startsWith("Explain") } ?: "",600,
        onDismiss={questionDialog=false},onSubmit={ text -> questionDialog=false; ask(text) })
    if(settingsDialog) InputDialog("Connect to SceneBridge","http://10.0.2.2:3000","Connect",baseUrl,250,
        errorMessage=settingsError,
        onDismiss={settingsDialog=false},onSubmit={ value ->
            try {
                SceneBridgeApi(value.trim())
                closeAnswer(false); savePosition(); player.stop(); film=null
                baseUrl=value.trim().trimEnd('/'); prefs.edit().putString("api_url",baseUrl).apply()
                settingsDialog=false; loadGeneration++
            } catch(error: Exception) { settingsError="Enter a valid http:// or https:// server address." }
        })
}

@Composable
private fun ActionButton(label: String,enabled: Boolean=true,wide: Boolean=false,onClick: ()->Unit) {
    Button(onClick=onClick,enabled=enabled,modifier=if(wide) Modifier.fillMaxWidth() else Modifier,
        colors=ButtonDefaults.colors(containerColor=Color(0xFF213342),contentColor=White,focusedContainerColor=Teal,focusedContentColor=Ink)) {
        Text(label,fontSize=12.sp,fontWeight=FontWeight.Medium)
    }
}

@Composable
private fun Logo() {
    Canvas(Modifier.size(26.dp)) {
        drawRoundRect(Teal,cornerRadius=androidx.compose.ui.geometry.CornerRadius(5f,5f),style=androidx.compose.ui.graphics.drawscope.Stroke(2f))
        val path=androidx.compose.ui.graphics.Path().apply { moveTo(size.width*.38f,size.height*.27f); lineTo(size.width*.7f,size.height*.5f); lineTo(size.width*.38f,size.height*.73f); close() }
        drawPath(path,Teal)
    }
}

@Composable
private fun InputDialog(title: String,placeholder: String,submit: String,initial: String,maxLength: Int,errorMessage: String?=null,onDismiss: ()->Unit,onSubmit: (String)->Unit) {
    var value by remember { mutableStateOf(initial) }
    var focused by remember { mutableStateOf(false) }
    Dialog(onDismissRequest=onDismiss) {
        Column(Modifier.width(520.dp).background(Panel,RoundedCornerShape(18.dp)).padding(28.dp),verticalArrangement=Arrangement.spacedBy(18.dp)) {
            Text(title,color=White,fontSize=23.sp,fontWeight=FontWeight.Bold)
            Box(Modifier.fillMaxWidth().border(2.dp,if(focused) Teal else Muted,RoundedCornerShape(8.dp)).padding(15.dp)) {
                if(value.isEmpty()) Text(placeholder,color=Muted,fontSize=16.sp)
                BasicTextField(value=value,onValueChange={value=it.take(maxLength)},textStyle=TextStyle(color=White,fontSize=16.sp),
                    cursorBrush=Brush.verticalGradient(listOf(Teal,Teal)),modifier=Modifier.fillMaxWidth().onFocusChanged { focused=it.isFocused },singleLine=true)
            }
            if(errorMessage!=null) Text(errorMessage,color=Gold,fontSize=12.sp)
            Row(horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                ActionButton(submit,enabled=value.isNotBlank()) { onSubmit(value.trim()) }
                ActionButton("Cancel") { onDismiss() }
            }
        }
    }
}
