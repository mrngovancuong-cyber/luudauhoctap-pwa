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

  // --- Xử lý Proxy cho Google Apps Script (PHẦN ĐÃ SỬA) ---
  
  // 1. Xây dựng URL đích một cách an toàn
  const destinationUrl = new URL(SCRIPT_URL);
  // Thêm tất cả các query params từ request gốc vào URL đích
  for (const param in event.queryStringParameters) {
    destinationUrl.searchParams.append(param, event.queryStringParameters[param]);
  }
  
  console.log(`[Proxy] Chuyển tiếp ${event.httpMethod} đến: ${destinationUrl.toString()}`);

  try {
    // 2. Thực hiện request đến Google Apps Script
    const response = await fetch(destinationUrl.toString(), {
      method: event.httpMethod,
      headers: {
        // Chuyển tiếp chính xác header 'authorization' (lưu ý: netlify chuyển thành chữ thường)
        'authorization': event.headers.authorization || '',
        'content-type': event.headers['content-type'] || 'application/json'
      },
      // Chỉ gửi body nếu có
      body: event.body,
    });
    
    const data = await response.text();

    console.log(`[Proxy] Phản hồi từ Google: ${data}`);

    // 3. Trả về phản hồi cho trình duyệt
    return {
      statusCode: response.status,
      headers: { "Content-Type": "application/json" },
      body: data,
    };

  } catch (error) {
    console.error('[Proxy] Lỗi nghiêm trọng:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "Proxy Server Error: " + error.message })
    };
  }
};