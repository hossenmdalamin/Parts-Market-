package com.partsmarket.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AlertDialog
import androidx.core.content.edit

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private val prefs by lazy { getSharedPreferences("parts_market_settings", MODE_PRIVATE) }
    private val websiteUrl = "https://parts-market.pages.dev/"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.settings.setSupportMultipleWindows(false)
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                val uri = Uri.parse(url)
                return if (uri.host == "parts-market.pages.dev") false else {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                }
            }
            override fun onPageFinished(view: WebView, url: String) {
                applyThemeToPage()
            }
        }
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(AppBridge(), "PartsMarketApp")
        webView.loadUrl(websiteUrl)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
    }

    private fun applyThemeToPage() {
        val theme = prefs.getString("theme", "system") ?: "system"
        val js = "document.documentElement.dataset.appTheme = '$theme';"
        webView.evaluateJavascript(js, null)
    }

    private inner class AppBridge {
        @JavascriptInterface fun getTheme(): String =
            prefs.getString("theme", "system") ?: "system"

        @JavascriptInterface fun setTheme(theme: String) {
            if (theme in listOf("light", "dark", "system")) {
                prefs.edit { putString("theme", theme) }
                runOnUiThread { applyThemeToPage() }
            }
        }

        @JavascriptInterface fun openThemeSettings() {
            runOnUiThread {
                val options = arrayOf("System default", "Light", "Dark")
                val current = prefs.getString("theme", "system")
                val selected = options.indexOf(
                    when (current) { "light" -> "Light"; "dark" -> "Dark"; else -> "System default" }
                ).coerceAtLeast(0)
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("App theme")
                    .setSingleChoiceItems(options, selected) { dialog, which ->
                        val value = when (which) { 1 -> "light"; 2 -> "dark"; else -> "system" }
                        prefs.edit { putString("theme", value) }
                        applyThemeToPage()
                        dialog.dismiss()
                    }.setNegativeButton("Cancel", null).show()
            }
        }
    }

    override fun onDestroy() {
        webView.removeJavascriptInterface("PartsMarketApp")
        webView.destroy()
        super.onDestroy()
    }
}
