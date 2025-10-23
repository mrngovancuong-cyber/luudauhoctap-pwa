// File: netlify/functions/proxy.js
// PHIÊN BẢN CUỐI CÙNG - GỬI TOKEN QUA URL

import fetch from 'node-fetch';

// Lấy URL của Google Script từ biến môi trường trên Netlify.
const SCRIPT_URL = process.env.SCRIPT_URL;

export const handler = async (event) => {
  // --- Phần 1: Xử lý Proxy cho Google Drive (giữ nguyên logic cũ của bạn) ---
  if (event.path.startsWith('/api/gdrive-proxy/')) {
    const fileId = event.path.replace('/api/gdrive-proxy/', '');
    if (!fileId) {
      return { statusCode: 400, body: 'Thiếu File ID.' };
    }
    const gdriveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    try {
      const driveResponse = await fetch(gdriveUrl);
      if (!driveResponse.ok) {
        throw new Error(`Google Drive error: ${driveResponse.statusText}`);
      }
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

  // --- Phần 2: Xử lý Proxy cho Google Apps Script (PHẦN NÂNG CẤP) ---

  // Kiểm tra xem SCRIPT_URL đã được cấu hình trên Netlify chưa.
  if (!SCRIPT_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "Lỗi cấu hình: Biến môi trường SCRIPT_URL chưa được thiết lập trên Netlify." })
    };
  }

  // BƯỚC A: XÂY DỰNG URL ĐÍCH
  const destinationUrl = new URL(SCRIPT_URL);
  // Gắn tất cả các tham số từ URL gốc (như ?action=... &examId=...) vào URL đích.
  for (const param in event.queryStringParameters) {
    destinationUrl.searchParams.append(param, event.queryStringParameters[param]);
  }

  // BƯỚC B: LẤY TOKEN TỪ HEADER VÀ GẮN NÓ VÀO URL ĐÍCH
  const incomingHeaders = event.headers || {};
  const authToken = incomingHeaders.authorization || incomingHeaders.Authorization; // Lấy token một cách an toàn
  
  if (authToken) {
    // Nếu có token, gắn nó vào URL dưới dạng một tham số mới tên là 'authToken'.
    destinationUrl.searchParams.append('authToken', authToken);
  }
  
  // BƯỚC C: CHUẨN BỊ CÁC TÙY CHỌN CHO REQUEST FETCH
  const options = {
    method: event.httpMethod,
    headers: {
      // Chúng ta không cần gửi 'authorization' trong header nữa vì nó đã ở trong URL.
      // Chỉ cần gửi 'content-type' cho các request POST.
      'content-type': incomingHeaders['content-type'] || 'application/json'
    },
    redirect: 'follow'
  };

  // Chỉ thêm 'body' vào options nếu đó là request POST/PUT... và có body.
  if (event.httpMethod.toUpperCase() !== 'GET' && event.httpMethod.toUpperCase() !== 'HEAD' && event.body) {
    options.body = event.body;
  }
  
  // Ghi log để debug (bạn có thể xem log này trong trang quản lý function của Netlify)
  console.log(`[Proxy] Chuyển tiếp đến: ${destinationUrl.toString()}`);

  try {
    // BƯỚC D: THỰC HIỆN REQUEST ĐẾN GOOGLE APPS SCRIPT
    const response = await fetch(destinationUrl.toString(), options);
    const data = await response.text(); // Lấy phản hồi dưới dạng text

    // BƯỚC E: TRẢ VỀ PHẢN HỒI CHO TRÌNH DUYỆT
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