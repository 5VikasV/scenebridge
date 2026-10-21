package com.scenebridge.tv

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

class SceneBridgeApi(val baseUrl: String) {
    init {
        val uri = URI(baseUrl)
        require(uri.scheme in listOf("http", "https") && !uri.host.isNullOrBlank()) { "Enter a valid http:// or https:// server address." }
    }
    private fun absolute(path: String): String = URI(baseUrl.trimEnd('/') + "/").resolve(path).toString()
    private suspend fun request(path: String, body: JSONObject? = null): JSONObject = withContext(Dispatchers.IO) {
        val connection = URL(absolute(path)).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 5000
            connection.readTimeout = 25000
            connection.setRequestProperty("Accept", "application/json")
            if (body != null) {
                connection.requestMethod = "POST"
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.bufferedWriter().use { it.write(body.toString()) }
            }
            val code = connection.responseCode
            val text = (if (code in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() } ?: "{}"
            val json = JSONObject(text)
            check(code in 200..299) { json.optString("error", "The server is unavailable. Please retry.") }
            json
        } finally { connection.disconnect() }
    }
    suspend fun catalog(): Film {
        val catalog = request("/catalog")
        val f = catalog.getJSONArray("videos").getJSONObject(0)
        return Film(f.getString("id"),f.getString("title"),f.getString("subtitle"),f.getLong("durationMs"),
            absolute(f.getString("mediaUrl")),absolute(f.getString("captionsUrl")),catalog.getString("mode"))
    }
    suspend fun ask(film: Film, positionMs: Long, question: String): Answer {
        val data = request("/ask",JSONObject().put("videoId",film.id).put("positionMs",positionMs).put("question",question))
        val array = data.getJSONArray("citations")
        val citations = (0 until array.length()).map { i ->
            val c = array.getJSONObject(i)
            Evidence(c.getString("id"),c.getLong("startMs"),c.getLong("endMs"),c.getString("text"))
        }
        check(data.getLong("cutoffMs") == positionMs && citations.all { it.startMs >= 0 && it.endMs > it.startMs && it.endMs <= positionMs }) { "The answer did not match this playback position. Please retry." }
        return Answer(data.getString("answer"),data.getString("status"),data.getLong("cutoffMs"),citations,data.getString("mode"))
    }
}
