// netlify/functions/proxy.js - PHIÊN BẢN KẾT HỢP HOÀN CHỈNH

const fetch = require('node-fetch');

exports.handler = async function (event, context) {

  // ===================================================================
  //   PHẦN MỚI: BỘ ĐIỀU HƯỚNG CHO GOOGLE DRIVE PROXY
  // ===================================================================
  
  // Kiểm tra xem đây có phải là request cho Google Drive không
  if (event.path.startsWith('/api/gdrive-proxy/')) {
    // Lấy File ID từ URL
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
          'Cache-Control': 'public, max-age=31536000' // Cho phép cache mạnh mẽ
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
  //   PHẦN CŨ: LOGIC CHO GOOGLE APPS SCRIPT (GIỮ NGUYÊN)
  //   Nếu request không phải cho Google Drive, code sẽ chạy tiếp xuống đây.
  // ===================================================================

  const scriptUrl = process.env.SCRIPT_URL;

  if (!scriptUrl) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "Lỗi: SCRIPT_URL chưa được cấu hình trên Netlify." })
    };
  }

  const queryString = event.rawQuery ? `?${event.rawQuery}` : "";
  const fullUrl = scriptUrl + queryString;
  
  try {
    const options = {
      method: event.httpMethod,
      headers: {
        "Content-Type": event.headers["content-type"] || "text/plain",
      },
    };

    if (event.httpMethod === 'POST' && event.body) {
      options.body = event.body;
    }

    const googleResponse = await fetch(fullUrl, options);
    const data = await googleResponse.text();

    return {
      statusCode: googleResponse.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: data,
    };

  } catch (error) {
    console.error("Lỗi Proxy Apps Script:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "Proxy gặp lỗi khi kết nối đến Google Script." })
    };
  }
};