// File: netlify/functions/proxy.js
// PHIÊN BẢN HOÀN CHỈNH - SỬA LỖI CÚ PHÁP VÀ LOGIC

const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  
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
      body: JSON.stringify({ success: false, message: "Lỗi: SCRIPT_URL chưa được cấu hình." })
    };
  }

  const queryString = event.rawQuery ? `?${event.rawQuery}` : "";
  const fullUrl = scriptUrl + queryString;
  
  const options = {
    method: event.httpMethod,
    headers: {
      'Authorization': event.headers.authorization || '', // Đảm bảo chuyển tiếp
      'Content-Type': event.headers['content-type'] || 'text/plain;charset=utf-8'
    },
    // Chuyển hướng theo Google Apps Script nếu cần
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
    console.error("Lỗi Proxy Apps Script:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "Proxy gặp lỗi: " + error.message })
    };
  }
};