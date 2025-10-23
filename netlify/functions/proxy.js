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

  // Lấy URL của Apps Script từ biến môi trường của Netlify
const scriptUrl = process.env.SCRIPT_URL;

if (!scriptUrl) {
  return {
    statusCode: 500,
    body: JSON.stringify({ success: false, message: "Lỗi: SCRIPT_URL chưa được cấu hình trên Netlify." })
  };
}

const queryString = event.rawQuery ? `?${event.rawQuery}` : "";
const fullUrl = scriptUrl + queryString;

// Chuẩn bị các tùy chọn cho request `fetch`
const options = {
  method: event.httpMethod,
  headers: {
    // **DÒNG SỬA LỖI QUAN TRỌNG NHẤT**
    // Lấy header 'authorization' từ request gốc và chuyển tiếp nó
    'Authorization': event.headers.authorization || '',

    // Chuyển tiếp cả 'Content-Type' nếu có
    'Content-Type': event.headers['content-type'] || 'text/plain;charset=utf-8'
  }
};

// Chỉ thêm 'body' vào request nếu nó tồn tại
if (event.body) {
  options.body = event.body;
}

try {
  // Gọi đến Google Apps Script với đầy đủ thông tin
  const googleResponse = await fetch(fullUrl, options);
  const data = await googleResponse.text();

  // Trả kết quả về cho trình duyệt
  // Chúng ta không cần thêm các header CORS ở đây vì Netlify đã xử lý
  return {
    statusCode: googleResponse.status,
    headers: {
      // Chỉ cần đảm bảo trả về đúng kiểu nội dung
      "Content-Type": "application/json" 
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