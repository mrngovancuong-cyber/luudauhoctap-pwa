// File: netlify/functions/proxy.js
// PHIÊN BẢN ĐÃ ĐƯỢC SỬA LỖI VÀ ĐƠN GIẢN HÓA

import fetch from 'node-fetch';

// Dán URL thực thi của Google Apps Script của bạn vào đây
// Bạn cũng có thể dùng biến môi trường như cũ: const SCRIPT_URL = process.env.SCRIPT_URL;
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbydr4uigyqHtjpstmYCVchp3ovGDMQQa12EiIpbjgPDBNybXDvS0tVnysBBHn0PVBlg/exec";

export const handler = async (event) => {
  // --- Xử lý Google Drive Proxy (Giữ nguyên logic của bạn) ---
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

  // --- Xử lý Proxy cho Google Apps Script (PHẦN SỬA LỖI TRIỆT ĐỂ) ---
  
  // Kiểm tra SCRIPT_URL
  if (!SCRIPT_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "Lỗi cấu hình: SCRIPT_URL chưa được thiết lập trên Netlify." })
    };
  }

  // 1. Xây dựng URL đích với các tham số
  const destinationUrl = new URL(SCRIPT_URL);
  for (const param in event.queryStringParameters) {
    destinationUrl.searchParams.append(param, event.queryStringParameters[param]);
  }

  // 2. Tường minh xây dựng đối tượng headers để gửi đi
  const headersToSend = {};
  
  // Lấy header 'content-type' từ request gốc (nếu có)
  if (event.headers['content-type']) {
    headersToSend['content-type'] = event.headers['content-type'];
  }
  
  // Lấy header 'authorization' từ request gốc (nếu có)
  // Đây là phần quan trọng nhất, chúng ta kiểm tra cả chữ hoa và chữ thường
  const authToken = event.headers.authorization || event.headers.Authorization;
  if (authToken) {
    headersToSend['authorization'] = authToken;
  }
  
  // 3. Chuẩn bị các tùy chọn cho request fetch
  const options = {
    method: event.httpMethod,
    headers: headersToSend, // <--- Sử dụng đối tượng headers đã được xây dựng tường minh
    redirect: 'follow'
  };

  // Chỉ thêm 'body' vào options nếu phương thức cho phép và có body
  if (event.httpMethod.toUpperCase() !== 'GET' && event.httpMethod.toUpperCase() !== 'HEAD' && event.body) {
    options.body = event.body;
  }

  console.log(`[Proxy] Forwarding to: ${destinationUrl.toString()}`);
  console.log(`[Proxy] Options sent:`, JSON.stringify(options, null, 2));

  try {
    // 4. Thực hiện request đến Google
    const response = await fetch(destinationUrl.toString(), options);
    const data = await response.text(); // Lấy data dưới dạng text để tránh lỗi parse JSON nếu Google trả về lỗi HTML

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