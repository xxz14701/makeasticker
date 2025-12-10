// 這是用於 Vercel 或 Netlify Serverless Function 的範例 Node.js 程式碼

// 引入所需的 fetch 函數 (在 Node 環境中，我們通常需要安裝 node-fetch，
// 但 Vercel/Netlify 環境通常內建了 global fetch)

/**
 * 處理來自前端的 POST 請求，並將其代理到 Google Gemini API。
 * 這個函式會從環境變數中讀取 API 金鑰 (process.env.GEMINI_API_KEY)。
 * * @param {object} req - 請求物件 (包含 body)
 * @param {object} res - 回應物件
 */
export default async function handler(req, res) {
    // 從環境變數中安全地獲取 API 金鑰
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        // 如果沒有設定金鑰，立即回傳錯誤，金鑰是安全的
        return res.status(500).json({ error: "Server error: API Key is not configured." });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    try {
        // 解析前端發送的 body 內容 (包含了 promptText 和 image)
        const { promptText, image, model } = JSON.parse(req.body);

        if (!promptText || !image || !image.data || !image.mimeType) {
            return res.status(400).json({ error: "Missing required data: prompt or image." });
        }

        // 組裝傳遞給 Google API 的 Payload
        const apiPayload = {
            contents: [{
                parts: [
                    { text: promptText },
                    {
                        inlineData: {
                            mimeType: image.mimeType,
                            data: image.data
                        }
                    }
                ]
            }],
            generationConfig: {
                responseModalities: ['TEXT', 'IMAGE']
            },
        };

        // 呼叫 Gemini API
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(apiPayload)
        });

        // 處理 API 錯誤
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API Error:", errorText);
            return res.status(response.status).json({ error: `Gemini API call failed: ${response.statusText}`, details: errorText });
        }

        const result = await response.json();
        const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

        if (base64Data) {
            // 成功：回傳圖片 Base64 數據給前端
            res.status(200).json({ base64Data: base64Data });
        } else {
            // 失敗：API 成功但沒有生成圖片
            res.status(500).json({ error: "Gemini API did not return image data." });
        }

    } catch (error) {
        console.error('Proxy internal error:', error);
        res.status(500).json({ error: `Internal server error: ${error.message}` });
    }
}