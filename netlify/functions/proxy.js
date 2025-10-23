// File: netlify/functions/proxy.js
// PHIÊN BẢN CUỐI CÙNG, ỔN ĐỊNH VÀ AN TOÀN

import fetch from 'node-fetch';

export const handler = async (event, context) => {
  
  // --- Phần Google Drive Proxy ---
  if (event.path.startsWith('/api/gdrive-proxy/')) {
    const fileId = event.path.replace('/api/gdrive-proxy/', '');
    if (!fileId) return { statusCode: 400, body: 'Thiếu File ID.' };
    const gdriveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    try {
      const driveResponse = await fetch(gdriveUrl);
      if (!driveResponse.ok) throw new Error(`Google Drive error: ${driveResponse.statusText}`);
      const buffer = await driveResponse.buffer();
      return {
        statusCode: 200,
        headers: {
          'Content-Type': driveResponse.headers.get('content-type') || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000'
        },
        body: buffer.toString('base64'),
        isBase64Encoded: true,
      };
    } catch (error) {
      return { statusCode: 502, body: `Lỗi GDrive Proxy: ${error.message}` };
    }
  }

  // --- PHẦN PROXY CHO GOOGLE APPS SCRIPT ---

  const scriptUrl = process.env.SCRIPT_URL;
  if (!scriptUrl) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "Lỗi cấu hình: SCRIPT_URL" })
    };
  }

  const queryString = event.rawQuery ? `?${event.rawQuery}` : "";
  const fullUrl = scriptUrl + queryString;
  
  // Tìm header 'authorization' một cách an toàn, không phân biệt hoa/thường.
  const authHeader = event.headers.authorization || event.headers.Authorization || null;

  const options = {
    method: event.httpMethod,
    headers: {
      'Authorization': authHeader || '', // Sử dụng biến authHeader
      'Content-Type': event.headers['content-type'] || 'text/plain;charset=utf-8'
    },
    redirect: 'follow'
  };

  if (event.body) {
    options.body = event.body;
  }

  try {
    const googleResponse = await fetch(fullUrl, options);
    const data = await googleResponse.text();
    return {
      statusCode: googleResponse.status,
      headers: { "Content-Type": "application/json" },
      body: data,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "Proxy gặp lỗi: " + error.message })
    };
  }
};