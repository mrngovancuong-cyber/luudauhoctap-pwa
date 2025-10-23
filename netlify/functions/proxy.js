// File: netlify/functions/proxy.js
// PHIÊN BẢN CHỐNG ĐẠN (BULLETPROOF)

import fetch from 'node-fetch';

const SCRIPT_URL = process.env.SCRIPT_URL;

export const handler = async (event) => {
  // --- Xử lý Google Drive Proxy (Giữ nguyên) ---
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
        headers: { 'Content-Type': driveResponse.headers.get('content-type') || 'application/octet-stream' },
        body: buffer.toString('base64'),
        isBase64Encoded: true,
      };
    } catch (error) {
      return { statusCode: 502, body: `Lỗi GDrive Proxy: ${error.message}` };
    }
  }

  // --- Xử lý Proxy cho Google Apps Script ---
  
  if (!SCRIPT_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "Lỗi cấu hình: SCRIPT_URL." })
    };
  }

  // 1. Xây dựng URL đích
  const destinationUrl = new URL(SCRIPT_URL);
  for (const param in event.queryStringParameters) {
    destinationUrl.searchParams.append(param, event.queryStringParameters[param]);
  }

  // 2. Xây dựng headers một cách an toàn
  const headersToSend = {};
  
  // Kiểm tra an toàn: chỉ truy cập các thuộc tính của 'headers' nếu 'event.headers' tồn tại
  const incomingHeaders = event.headers || {};
  
  const authToken = incomingHeaders.authorization || incomingHeaders.Authorization;
  if (authToken) {
    headersToSend['authorization'] = authToken;
  }
  
  if (incomingHeaders['content-type']) {
    headersToSend['content-type'] = incomingHeaders['content-type'];
  }
  
  // 3. Chuẩn bị options cho fetch
  const options = {
    method: event.httpMethod,
    headers: headersToSend,
    redirect: 'follow'
  };

  if (event.httpMethod.toUpperCase() !== 'GET' && event.body) {
    options.body = event.body;
  }
  
  console.log(`[Proxy] Forwarding to: ${destinationUrl.toString()}`);
  console.log(`[Proxy] Options sent:`, JSON.stringify(options, null, 2));

  try {
    // 4. Thực hiện request
    const response = await fetch(destinationUrl.toString(), options);
    const data = await response.text();

    // 5. Trả về phản hồi
    return {
      statusCode: response.status,
      headers: { "Content-Type": "application/json" },
      body: data,
    };

  } catch (error) {
    console.error('[Proxy] Critical Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "Proxy Server Error: " + error.message })
    };
  }
};