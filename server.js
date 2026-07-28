const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const uploadDir = path.join(root, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

const username = 'silverton';
const password = 'silverton123';

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = mimeTypes[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);
  res.writeHead(200, { 'Content-Type': type });
  stream.pipe(res);
}

function parseMultipart(req, boundary) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const fields = {};
      const files = {};
      const delimiter = Buffer.from(`--${boundary}`);
      const parts = body.split(delimiter).slice(1, -1);

      parts.forEach(part => {
        const section = part.toString('binary');
        const headersEnd = section.indexOf('\r\n\r\n');
        if (headersEnd === -1) return;
        const headerText = section.slice(0, headersEnd);
        const bodyText = section.slice(headersEnd + 4, -2);
        const nameMatch = headerText.match(/name="([^"]+)"/);
        if (!nameMatch) return;
        const name = nameMatch[1];
        if (headerText.includes('filename="')) {
          const fileNameMatch = headerText.match(/filename="([^"]*)"/);
          const fileName = fileNameMatch ? fileNameMatch[1] : 'upload';
          const buffer = Buffer.from(bodyText, 'binary');
          files[name] = [{ filename: fileName, buffer }];
        } else {
          fields[name] = bodyText.replace(/\r\n$/, '');
        }
      });

      resolve({ fields, files });
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/upload-hero') {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return sendJson(res, 400, { ok: false, message: 'Expected multipart form upload.' });
    }

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return sendJson(res, 400, { ok: false, message: 'Missing multipart boundary.' });
    }

    try {
      const { fields, files } = await parseMultipart(req, boundary);
      if ((fields.username || '').toString() !== username || (fields.password || '').toString() !== password) {
        return sendJson(res, 401, { ok: false, message: 'Invalid username or password.' });
      }

      const uploadedFile = files.heroImage && files.heroImage[0];
      if (!uploadedFile || !uploadedFile.buffer) {
        return sendJson(res, 400, { ok: false, message: 'No file uploaded.' });
      }

      const targetPath = path.join(uploadDir, 'hero.jpg');
      fs.writeFileSync(targetPath, uploadedFile.buffer);
      return sendJson(res, 200, { ok: true, message: 'Hero image updated successfully.' });
    } catch (error) {
      return sendJson(res, 500, { ok: false, message: 'Upload failed.' });
    }
  }

  if (req.url.startsWith('/uploads/')) {
    const filePath = path.join(root, req.url);
    if (fs.existsSync(filePath)) return sendFile(res, filePath);
    return sendJson(res, 404, { ok: false, message: 'File not found.' });
  }

  const requestedPath = req.url === '/' ? '/index.html' : req.url;
  let filePath = path.join(root, requestedPath);

  if (!path.extname(filePath)) filePath = path.join(filePath, 'index.html');

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return sendFile(res, filePath);
  }

  sendJson(res, 404, { ok: false, message: 'Not found.' });
});

server.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});
