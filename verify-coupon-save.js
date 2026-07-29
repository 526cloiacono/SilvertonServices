const http = require('http');
const boundary = '----verifyboundary';
const body = [
  `--${boundary}\r\nContent-Disposition: form-data; name="username"\r\n\r\nsilverton\r\n`,
  `--${boundary}\r\nContent-Disposition: form-data; name="password"\r\n\r\nsilverton123\r\n`,
  `--${boundary}\r\nContent-Disposition: form-data; name="couponTarget"\r\n\r\n0\r\n`,
  `--${boundary}\r\nContent-Disposition: form-data; name="couponTitle"\r\n\r\nServer Verified Coupon\r\n`,
  `--${boundary}\r\nContent-Disposition: form-data; name="couponDetails"\r\n\r\nSaved through the shared API\r\n`,
  `--${boundary}--\r\n`
].join('');

const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/coupons',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': Buffer.byteLength(body)
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(data);
  });
});

req.on('error', err => {
  console.error(err);
  process.exit(1);
});

req.write(body);
req.end();
