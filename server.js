const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

const VIDEO_DIRS = [
  path.join(__dirname, 'videos'),
  __dirname
];

const SUPPORTED_VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.mkv'];
const SUPPORTED_SUB_EXTS = ['.vtt', '.srt'];

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.vtt': 'text/vtt; charset=UTF-8',
  '.srt': 'text/plain; charset=UTF-8'
};

// Locate active video file
function findVideoFile(requestedName) {
  if (requestedName) {
    const safeName = path.basename(requestedName);
    for (const dir of VIDEO_DIRS) {
      const fullPath = path.join(dir, safeName);
      if (fs.existsSync(fullPath)) return fullPath;
    }
  }

  for (const dir of VIDEO_DIRS) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      const match = files.find(file => {
        const ext = path.extname(file).toLowerCase();
        return SUPPORTED_VIDEO_EXTS.includes(ext);
      });
      if (match) return path.join(dir, match);
    }
  }

  return null;
}

// Find all subtitle files in the videos directory
function findSubtitleFiles() {
  const subtitles = [];
  for (const dir of VIDEO_DIRS) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (SUPPORTED_SUB_EXTS.includes(ext)) {
          subtitles.push({
            name: file,
            label: path.basename(file, ext).replace(/[._-]/g, ' '),
            ext: ext
          });
        }
      }
    }
  }
  return subtitles;
}

// Convert SRT format to WebVTT format
function srtToVtt(srtContent) {
  let vtt = srtContent.replace(/\r\n|\r/g, '\n');
  vtt = vtt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return 'WEBVTT\n\n' + vtt.trim() + '\n';
}

// -------------------------------------------------------------
// Real-Time Watch Party Sync Engine (Zero-dependency WebSockets)
// -------------------------------------------------------------
const rooms = new Map(); // roomId -> Set of socket clients
const roomStates = new Map(); // roomId -> { lastAction, lastTime, isPlaying, updatedAt }

function parseWebSocketFrame(buffer) {
  if (buffer.length < 2) return null;
  const firstByte = buffer[0];
  const opcode = firstByte & 0x0f;
  if (opcode === 0x8) return { type: 'close' };
  if (opcode === 0x9) return { type: 'ping' };
  if (opcode === 0xa) return { type: 'pong' };

  const isMasked = (buffer[1] & 0x80) === 0x80;
  let payloadLen = buffer[1] & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buffer.length < 4) return null;
    payloadLen = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buffer.length < 10) return null;
    payloadLen = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  if (!isMasked || buffer.length < offset + 4 + payloadLen) return null;

  const mask = buffer.slice(offset, offset + 4);
  offset += 4;
  const payload = Buffer.alloc(payloadLen);
  for (let i = 0; i < payloadLen; i++) {
    payload[i] = buffer[offset + i] ^ mask[i % 4];
  }

  return {
    type: 'text',
    payload: payload.toString('utf8'),
    totalBytes: offset + payloadLen
  };
}

function makeWebSocketFrame(data) {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  const payload = Buffer.from(jsonStr, 'utf8');
  const len = payload.length;

  if (len < 126) {
    const frame = Buffer.alloc(2 + len);
    frame[0] = 0x81; // FIN + text opcode
    frame[1] = len;
    payload.copy(frame, 2);
    return frame;
  } else if (len < 65536) {
    const frame = Buffer.alloc(4 + len);
    frame[0] = 0x81;
    frame[1] = 126;
    frame.writeUInt16BE(len, 2);
    payload.copy(frame, 4);
    return frame;
  } else {
    const frame = Buffer.alloc(10 + len);
    frame[0] = 0x81;
    frame[1] = 127;
    frame.writeBigUInt64BE(BigInt(len), 2);
    payload.copy(frame, 10);
    return frame;
  }
}

function broadcastToRoom(roomId, message, excludeSocket = null) {
  const clients = rooms.get(roomId);
  if (!clients) return;

  const frame = makeWebSocketFrame(message);
  for (const client of clients) {
    if (client !== excludeSocket && client.writable) {
      try {
        client.write(frame);
      } catch (err) {
        // ignore closed socket errors
      }
    }
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method ? req.method.toUpperCase() : 'GET';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Video metadata endpoint
  if (pathname === '/api/video-info') {
    const videoPath = findVideoFile(parsedUrl.query.file);
    const subtitles = findSubtitleFiles();

    if (!videoPath) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        found: false,
        message: 'No video file found in the "videos" folder.',
        subtitles: subtitles
      }));
    }

    const stat = fs.statSync(videoPath);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      found: true,
      fileName: path.basename(videoPath),
      sizeBytes: stat.size,
      sizeMB: (stat.size / (1024 * 1024)).toFixed(2),
      format: path.extname(videoPath).replace('.', '').toUpperCase(),
      subtitles: subtitles
    }));
  }

  // Subtitle endpoint
  if (pathname.startsWith('/subtitles/')) {
    const rawSubName = decodeURIComponent(pathname.replace('/subtitles/', ''));
    const safeSubName = path.basename(rawSubName);
    
    let subFilePath = null;
    for (const dir of VIDEO_DIRS) {
      const fullPath = path.join(dir, safeSubName);
      if (fs.existsSync(fullPath)) {
        subFilePath = fullPath;
        break;
      }
    }

    if (!subFilePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Subtitle file not found');
    }

    const ext = path.extname(subFilePath).toLowerCase();
    const content = fs.readFileSync(subFilePath, 'utf8');

    res.writeHead(200, {
      'Content-Type': 'text/vtt; charset=UTF-8',
      'Access-Control-Allow-Origin': '*'
    });

    if (ext === '.srt') {
      res.end(srtToVtt(content));
    } else {
      res.end(content);
    }
    return;
  }

  // Video streaming endpoint with HTTP 206 Byte-Range support
  if (pathname === '/video') {
    const videoPath = findVideoFile(parsedUrl.query.file);
    if (!videoPath) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Video not found. Place a video into the "videos" folder.');
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const ext = path.extname(videoPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'video/mp4';
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const CHUNK_SIZE = 1536 * 1024; // 1.5MB chunk for fast, low-latency streaming across peers
      const requestedEnd = parts[1] ? parseInt(parts[1], 10) : NaN;
      const end = !isNaN(requestedEnd) ? requestedEnd : Math.min(start + CHUNK_SIZE, fileSize - 1);

      if (start >= fileSize || (requestedEnd && requestedEnd >= fileSize)) {
        res.writeHead(416, {
          'Content-Range': `bytes */${fileSize}`,
          'Content-Type': 'text/plain'
        });
        return res.end('Requested range not satisfiable');
      }

      const contentLength = end - start + 1;
      const stream = fs.createReadStream(videoPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': contentLength,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });

      stream.pipe(res);
      stream.on('error', (err) => {
        console.error('Streaming error:', err);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end('Streaming error');
        }
      });
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      fs.createReadStream(videoPath).pipe(res);
    }
    return;
  }

  // Serve static files from /public
  let relativePath = pathname === '/' ? 'index.html' : pathname;
  const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, 'public', safePath);

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      const fallbackPath = path.join(__dirname, 'public', 'index.html');
      if (fs.existsSync(fallbackPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        fs.createReadStream(fallbackPath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    }
  });
});

// -------------------------------------------------------------
// WebSocket Protocol Upgrade Handler
// -------------------------------------------------------------
server.on('upgrade', (req, socket, head) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const acceptKey = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`
  ];

  socket.write(headers.join('\r\n') + '\r\n\r\n');

  const roomId = (parsed.query.room || 'watchparty').toLowerCase().trim();
  const userName = parsed.query.user || 'Guest ' + Math.floor(100 + Math.random() * 900);
  const clientId = crypto.randomBytes(6).toString('hex');

  socket.roomId = roomId;
  socket.userName = userName;
  socket.clientId = clientId;

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  const roomClients = rooms.get(roomId);
  roomClients.add(socket);

  // Send current room status to newly joined client
  const currentState = roomStates.get(roomId) || { isPlaying: false, lastTime: 0 };
  const welcomeMsg = {
    type: 'init',
    roomId: roomId,
    clientId: clientId,
    userCount: roomClients.size,
    state: currentState
  };
  socket.write(makeWebSocketFrame(welcomeMsg));

  // Notify everyone in the room
  broadcastToRoom(roomId, {
    type: 'user_joined',
    user: userName,
    clientId: clientId,
    userCount: roomClients.size
  }, socket);

  let incomingBuffer = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    incomingBuffer = Buffer.concat([incomingBuffer, chunk]);

    while (incomingBuffer.length > 0) {
      const parsedFrame = parseWebSocketFrame(incomingBuffer);
      if (!parsedFrame) break; // Incomplete frame, wait for more data

      incomingBuffer = incomingBuffer.slice(parsedFrame.totalBytes);

      if (parsedFrame.type === 'close') {
        socket.destroy();
        return;
      }

      if (parsedFrame.type === 'text') {
        try {
          const msg = JSON.parse(parsedFrame.payload);

          // Handle Play, Pause, Seek synchronization
          if (['play', 'pause', 'seek', 'sync'].includes(msg.action)) {
            roomStates.set(roomId, {
              isPlaying: msg.action === 'play',
              lastTime: msg.time,
              updatedAt: Date.now()
            });

            broadcastToRoom(roomId, {
              type: 'sync',
              action: msg.action,
              time: msg.time,
              user: userName,
              clientId: clientId
            }, socket);
          }

          // Handle live chat & emoji reactions
          if (msg.action === 'chat') {
            broadcastToRoom(roomId, {
              type: 'chat',
              user: userName,
              text: msg.text,
              time: msg.time || 0
            });
          }
        } catch (e) {
          console.error('Error handling WebSocket message:', e);
        }
      }
    }
  });

  socket.on('close', () => {
    roomClients.delete(socket);
    if (roomClients.size === 0) {
      rooms.delete(roomId);
      roomStates.delete(roomId);
    } else {
      broadcastToRoom(roomId, {
        type: 'user_left',
        user: userName,
        clientId: clientId,
        userCount: roomClients.size
      });
    }
  });

  socket.on('error', () => {
    socket.destroy();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('========================================================');
  console.log('🎥 Private Video Streaming & Watch Party Server is running!');
  console.log(`📍 Web player:   http://localhost:${PORT}`);
  console.log(`📁 Video folder: ${path.join(__dirname, 'videos')}`);
  console.log('========================================================');
});
