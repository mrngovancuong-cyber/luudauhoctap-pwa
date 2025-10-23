// File: netlify/functions/proxy.js
// PHIÊN BẢN HOÀN CHỈNH - SỬA LỖI CÚ PHÁP VÀ LOGIC

import fetch from 'node-fetch'; // <<<< SỬA LỖI 1

export const handler = async (event, context) => { // <<<< SỬA LỖI 2
  
  
  // ===================================================================
  //   PHẦN 1: BỘ ĐIỀU HƯỚNG CHO GOOGLE DRIVE PROXY
  // ===================================================================
  if (event.path.startsWith('/api/gdrive-proxy/')) {
    const fileId = event.path.replace('/api/gdrive-proxy/', '');
    if (!fileId) {
      return { statusCode: 400, body: 'Thiếu File ID của Google Drive.' };
    }
    const gdriveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    try {
      const driveResponse = await fetch(gdriveUrl);
      if (!driveResponse.ok) {
        throw new Error(`Google Drive trả về lỗi: ${driveResponse.status} ${driveResponse.statusText}`);
      }
      
      const buffer = await driveResponse.buffer();
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': driveResponse.headers.get('content-type') || 'application/octet-stream',
          'Content-Length': buffer.length,
          'Cache-Control': 'public, max-age=31536000'
        },
        body: buffer.toString('base64'),
        isBase64Encoded: true,
      };

    } catch (error) {
      console.error('Lỗi Google Drive Proxy:', error);
      return { statusCode: 502, body: `Lỗi khi lấy file từ Google Drive: ${error.message}` };
    }
  }

  // ===================================================================
  //   PHẦN 2: LOGIC CHO GOOGLE APPS SCRIPT
  //   Nếu request không phải cho Google Drive, code sẽ chạy tiếp xuống đây.
  // ===================================================================
const scriptUrl = process.env.SCRIPT_URL;
  if (!scriptUrl) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "Lỗi cấu hình: SCRIPT_URL chưa được thiết lập." })
    };
  }

  // **DÒNG SỬA LỖI QUAN TRỌNG**
  // Đảm bảo rawQuery luôn được nối vào URL
  const queryString = event.rawQuery ? `?${event.rawQuery}` : "";
  const fullUrl = scriptUrl + queryString;
  
  const options = {
    method: event.httpMethod,
    headers: {
      'Authorization': event.headers.authorization || '',
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