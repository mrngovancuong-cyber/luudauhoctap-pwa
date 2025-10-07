// File: netlify/functions/proxy.js

const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  // URL của Google Apps Script sẽ được lấy từ biến môi trường của Netlify
  const scriptUrl = process.env.SCRIPT_URL;

  if (!scriptUrl) {
    return {
      statusCode: 500,
      body: "Lỗi: SCRIPT_URL chưa được cấu hình trên Netlify."
    };
  }

  // Lấy đường dẫn và các tham số truy vấn từ request gốc
  const queryString = event.rawQuery ? `?${event.rawQuery}` : "";
  const fullUrl = scriptUrl + queryString;
  
  try {
    const options = {
      method: event.httpMethod,
      headers: {
        // Chuyển tiếp header Content-Type nếu có
        "Content-Type": event.headers["content-type"] || "text/plain",
      },
    };

    // Nếu là request POST, chuyển tiếp cả body
    if (event.httpMethod === 'POST' && event.body) {
      options.body = event.body;
    }

    // Gọi đến Google Apps Script
    const googleResponse = await fetch(fullUrl, options);
    const data = await googleResponse.text();

    // Trả kết quả về cho PWA
    return {
      statusCode: googleResponse.status,
      // Thêm các header CORS để cho phép PWA ở localhost hoặc tên miền khác gọi được
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: data,
    };

  } catch (error) {
    console.error("Lỗi Proxy:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "Proxy gặp lỗi khi kết nối đến Google Script." })
    };
  }
};