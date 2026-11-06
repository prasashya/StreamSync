# 🎬 StreamSync — Self-Hosted Private Video Stream & Watch Party

> A lightweight, zero-dependency, self-hosted web streaming server and synchronized watch party platform. Host locally downloaded video files, stream smoothly with native byte-range seeking, customize subtitles, switch audio tracks, and watch together in real-time with friends across the internet for 100% free.

---

<!-- SCREENSHOT PLACEHOLDER: HERO / PLAYER INTERFACE -->
<!-- Replace the link below with your actual screenshot after uploading to GitHub -->
<p align="center">
  <img src="https://via.placeholder.com/900x500/0c0f17/6366f1?text=+Attach+Main+Web+Player+Screenshot+Here+" alt="StreamSync Player Interface" width="850">
</p>

---

## ✨ Features

- **⚡ Zero-Dependency Native Server**: Built using 100% native Node.js core modules (`http`, `crypto`, `fs`). No bloated `node_modules` required to run!
- **⏩ HTTP 206 Adaptive Byte-Range Streaming**: Smooth scrub-ahead and rewind capability without downloading the entire file upfront.
- **👥 Real-Time Synchronized Watch Party**:
  - **Shared Play/Pause/Seek**: Any participant can pause, resume, or jump to a timestamp; all viewers synchronize instantly.
  - **Anti-Stutter Buffer Shield**: Differentiates between true user pauses and internal browser buffering, preventing infinite freeze cascades.
  - **Seamless Drift Auto-Catchup**: Subtly accelerates or decelerates playback speed (`1.06x` / `0.94x`) to align viewers without jarring pauses or buffer flushes.
  - **Room System & 1-Click Invites**: Join private rooms (`#watchparty`, `#movie-night`) and copy instant invite links.
  - **Interactive Reactions & Mini-Chat**: Send animated floating emojis (😂, ❤️, 🍿, ⏸️) and live messages directly over the video stream.
- **💬 Advanced Subtitle Customization**:
  - **Auto-Detection**: Auto-detects matching `.srt` and `.vtt` files in the video directory and auto-converts SRT to WebVTT on the fly.
  - **Custom Subtitle Upload**: Drag-and-drop or select any `.srt`/`.vtt` file directly in the browser.
  - **Real-Time Scaling**: Resize text from **60% up to 250%** (`A−` / `A+`).
  - **Theme Colors & Box Styles**: Choose White, Cinema Yellow (Netflix style), Cyan, or Green, with Translucent Box, Solid Black, or Outline Shadow styling.
  - **Subtitle Timing Sync**: Fine-tune subtitle delay (`-0.5s`, `+0.5s`, `Reset`).
  - **Persistent Settings**: Preserves subtitle preferences in browser `localStorage`.
- **🔊 Multi-Audio Language Support**:
  - Detects native embedded audio tracks where supported.
  - Allows uploading external audio files (e.g. alternate language dubs) that stay synchronized with video playback.
- **🌐 100% Free Global Tunneling (Cloudflare)**:
  - Zero bandwidth limits, zero account sign-up, zero credit card, and no interstitial warning pages.

---

<!-- SCREENSHOT PLACEHOLDER: SUBTITLE & AUDIO CONTROLS -->
<p align="center">
  <img src="https://via.placeholder.com/900x260/121826/a5b4fc?text=+Attach+Subtitle+and+Audio+Customization+Bar+Screenshot+Here+" alt="Subtitle & Audio Settings Bar" width="850">
</p>

---

## 📁 Project Structure

```text
livehosting/
│
├── public/
│   ├── index.html       # Responsive dark-mode single-page web app
│   └── style.css        # Glassmorphic UI, responsive layouts & cue styling
│
├── videos/              # Media directory (drop your videos & subtitles here)
│   ├── README.txt
│   └── (your-video.mp4 / .mkv / .webm)
│
├── server.js            # Node.js HTTP 206 streaming & native WebSocket engine
├── package.json         # Project metadata
├── .gitignore           # Ignores large video files & binary executables
└── README.md            # Documentation
```

---

## 🚀 Quick Start Walkthrough

### 1. Prerequisites
- **Node.js** (v16.0.0 or later installed on your system). Check with:
  ```bash
  node -v
  ```

---

### 2. Clone the Repository
```bash
git clone https://github.com/prasashya/streamsync.git
cd streamsync
```

---

### 3. Add Your Video & Subtitles
Copy any video (`.mp4`, `.webm`, `.mkv`) and optional subtitle file (`.srt`, `.vtt`) into the `videos/` folder:

```text
videos/
  ├── my-movie.mp4
  └── my-movie.srt
```
*Note: The server automatically detects the first video file found in the `videos/` folder.*

---

### 4. Start the Local Server
Run the lightweight server using standard Node.js:
```bash
node server.js
```

You should see:
```text
========================================================
🎥 Private Video Streaming & Watch Party Server is running!
📍 Web player:   http://localhost:3000
📁 Video folder: C:\...\livehosting\videos
========================================================
```

Open **[http://localhost:3000](http://localhost:3000)** in your web browser to test locally.

---

### 5. Share with Friends (100% Free Public Tunnel)

To allow anyone on the internet to join your stream without port forwarding or bandwidth caps, use **Cloudflare Tunnel**:

#### Step 1: Download Cloudflare Tunnel Standalone Executable
- Download the single executable: **[cloudflared-windows-amd64.exe](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe)**
- Place `cloudflared.exe` directly in your project root folder (`streamsync/`).

#### Step 2: Launch the Tunnel
Open a second terminal window (leaving `node server.js` running in the first) and execute:

```powershell
.\cloudflared.exe tunnel --url http://localhost:3000
```

Cloudflare will generate a public HTTPS link in your terminal:
```text
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://famous-words-example.trycloudflare.com                                            |
+--------------------------------------------------------------------------------------------+
```

*(Alternative options like **Localtunnel** (`npx localtunnel --port 3000`) or **Ngrok** (`ngrok http 3000`) can also be used).*

---

<!-- SCREENSHOT PLACEHOLDER: WATCH PARTY IN ACTION -->
<p align="center">
  <img src="https://via.placeholder.com/900x480/0c0f17/34d399?text=+Attach+Synchronized+Watch+Party+with+Friends+Screenshot+Here+" alt="Watch Party in Action" width="850">
</p>

---

## 👥 How to Host a Synchronized Watch Party

1. Start `node server.js` and launch your Cloudflare tunnel.
2. Open your public URL in the browser (e.g. `https://your-tunnel.trycloudflare.com`).
3. Click the **"Copy Invite Link"** button in the header bar.
4. Send the link to your friend.
5. Once your friend opens the link:
   - The viewer counter will update to **`2 Watching`**.
   - If either person presses **Play**, **Pause**, or **Seeks**, the video synchronizes across all screens in real-time.
   - Use the bottom interaction bar to send reactions (😂, ❤️, 🍿) or live chat messages that float across the screen!

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Play / Pause (Synchronizes for all viewers) |
| <kbd>←</kbd> / <kbd>→</kbd> | Seek backward / forward 5 seconds (Synchronizes for all) |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Adjust volume up / down |
| <kbd>M</kbd> | Toggle mute |
| <kbd>C</kbd> | Cycle / toggle subtitles on and off |
| <kbd>F</kbd> | Toggle full-screen mode |

---

## 🛠️ Technical Details & Architecture

### 1. HTTP 206 Partial Content (Byte-Range Streaming)
Video files are not downloaded in full. When the browser requests data, it passes an HTTP `Range: bytes=start-end` header. The server streams exactly that byte segment using Node.js read streams:
```http
HTTP/1.1 206 Partial Content
Content-Range: bytes 1048576-2621439/218157251
Accept-Ranges: bytes
Content-Length: 1572864
Content-Type: video/mp4
```
This enables zero-delay scrubbing and immediate playback without memory exhaustion.

### 2. Native WebSocket Protocol Engine (RFC 6455)
Real-time room synchronization is powered by a zero-dependency WebSocket handshake handler in `server.js` using Node's standard `crypto` module (`Sec-WebSocket-Accept`).

### 3. Anti-Cascade Buffer Algorithm
When streaming high-bitrate media over public tunnels, network hiccups can cause micro-buffering. Standard naive implementations broadcast a pause when the browser buffers, trapping both clients in an infinite stutter loop.
- **Intent Verification**: The player verifies `video.readyState` and checks user interaction flags before broadcasting pauses.
- **Continuous Rate Adjustment**: Small timing drifts (0.3s - 2.5s) are corrected by dynamically adjusting `video.playbackRate` between `0.94x` and `1.06x`, smoothly aligning streams without pauses or buffer flushes.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
