const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const uploadDir = path.join(root, 'uploads');
const dataDir = path.join(root, 'data');
const couponsDataFile = path.join(dataDir, 'coupons.json');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

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

const defaultCoupons = [
  {
    title: 'Free Brake Inspection',
    details: 'Stop by for a complimentary brake inspection and safety check.',
    image: '/IMG/silvertonheadNW.png'
  },
  {
    title: 'Tire Rotation Special',
    details: 'Enjoy a discounted tire rotation with every tire purchase this month.',
    image: '/IMG/silvertonheadNW.png'
  }
];

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
      const delimiter = `--${boundary}`;
      const bodyText = body.toString('binary');
      const parts = bodyText.split(delimiter).slice(1, -1);

      parts.forEach(part => {
        const section = part.trim();
        const headersEnd = section.indexOf('\r\n\r\n');
        if (headersEnd === -1) return;
        const headerText = section.slice(0, headersEnd);
        const bodyTextPart = section.slice(headersEnd + 4).replace(/\r\n$/, '');
        const nameMatch = headerText.match(/name="([^"]+)"/);
        if (!nameMatch) return;
        const name = nameMatch[1];
        if (headerText.includes('filename="')) {
          const fileNameMatch = headerText.match(/filename="([^"]*)"/);
          const fileName = fileNameMatch ? fileNameMatch[1] : 'upload';
          const buffer = Buffer.from(bodyTextPart, 'binary');
          files[name] = [{ filename: fileName, buffer }];
        } else {
          fields[name] = bodyTextPart.replace(/\r\n$/, '');
        }
      });

      resolve({ fields, files });
    });
    req.on('error', reject);
  });
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function getCouponsFromDisk() {
  if (!fs.existsSync(couponsDataFile)) {
    fs.writeFileSync(couponsDataFile, JSON.stringify(defaultCoupons, null, 2));
    return defaultCoupons;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(couponsDataFile, 'utf8'));
    return Array.isArray(parsed) && parsed.length ? parsed : defaultCoupons;
  } catch (error) {
    return defaultCoupons;
  }
}

function saveCouponsToDisk(coupons) {
  fs.writeFileSync(couponsDataFile, JSON.stringify(coupons, null, 2));
}

function saveUploadedImage(buffer, originalName) {
  const ext = path.extname(originalName || '').toLowerCase() || '.jpg';
  const fileName = `coupon-${Date.now()}-${Math.round(Math.random() * 10000)}${ext}`;
  const targetPath = path.join(uploadDir, fileName);
  fs.writeFileSync(targetPath, buffer);
  return `/uploads/${fileName}`;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/coupons') {
    return sendJson(res, 200, { ok: true, coupons: getCouponsFromDisk() });
  }

  if (req.method === 'DELETE' && req.url === '/api/coupons') {
    try {
      const body = await readRequestBody(req);
      const payload = body ? JSON.parse(body) : {};
      if ((payload.username || '').toString() !== username || (payload.password || '').toString() !== password) {
        return sendJson(res, 401, { ok: false, message: 'Invalid username or password.' });
      }
      saveCouponsToDisk(defaultCoupons);
      return sendJson(res, 200, { ok: true, coupons: defaultCoupons });
    } catch (error) {
      return sendJson(res, 400, { ok: false, message: 'Invalid request body.' });
    }
  }

  if (req.method === 'POST' && req.url === '/api/coupons') {
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

      const coupons = getCouponsFromDisk();
      const targetIndex = parseInt((fields.couponTarget || '').toString(), 10);
      let coupon = null;

      if (!Number.isNaN(targetIndex) && targetIndex >= 0 && targetIndex < coupons.length) {
        coupon = coupons[targetIndex];
      }

      if (!coupon) {
        coupon = { title: 'New Coupon Offer', details: 'More details coming soon.', image: '/IMG/silvertonheadNW.png' };
        coupons.unshift(coupon);
      }

      if ((fields.couponTitle || '').toString().trim()) {
        coupon.title = (fields.couponTitle || '').toString().trim();
      }

      if ((fields.couponDetails || '').toString().trim()) {
        coupon.details = (fields.couponDetails || '').toString().trim();
      }

      if (files.couponImage && files.couponImage[0] && files.couponImage[0].buffer) {
        coupon.image = saveUploadedImage(files.couponImage[0].buffer, files.couponImage[0].filename);
      }

      saveCouponsToDisk(coupons);
      return sendJson(res, 200, { ok: true, coupons: coupons });
    } catch (error) {
      return sendJson(res, 500, { ok: false, message: 'Coupon update failed.' });
    }
  }

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

server.listen(3000, '0.0.0.0', () => {
  console.log('Server listening on http://0.0.0.0:3000');
});
