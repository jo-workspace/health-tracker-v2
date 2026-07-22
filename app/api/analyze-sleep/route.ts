import { NextResponse } from 'next/server';

const MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash-lite'
];

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedPassword = process.env.APP_PASSWORD;
    if (expectedPassword && authHeader !== `Bearer ${expectedPassword}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image, mimeType } = await request.json();
    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 500 });
    }

    const prompt = `
You are a health data extraction assistant. I will provide a screenshot from my Garmin app.
Extract the following sleep and health metrics and return ONLY a valid JSON object.
Do NOT use markdown code blocks (\`\`\`json) or any other text. JUST the raw JSON.

Required JSON format:
{
  "bedTime": "HH:MM", // e.g. "23:30"
  "wakeTime": "HH:MM", // e.g. "07:30"
  "totalSleep": 7.5, // Total sleep in hours (as float)
  "deepSleep": 1.2, // Deep sleep in hours (as float)
  "remSleep": 1.8, // REM sleep in hours (as float)
  "hrv": 52, // Integer
  "restingHeartRate": 45, // Integer
  "stress": 14 // Integer (average stress level, if visible)
}

If a value is not visible or cannot be determined, set it to null.
Ensure times are in 24-hour format if possible. For example, 12:21 AM is 00:21. 07:13 AM is 07:13.
For durations like 1h 36m, convert it to float hours (e.g. 1 + 36/60 = 1.6).
`;

    // Remove the "data:image/jpeg;base64," prefix if it exists
    const base64Data = image.split(',').pop();

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1, // Keep it deterministic
      }
    };

    let lastError = '';
    let lastStatus = 500;

    // 依序嘗試多個 Gemini 模型以因應 429 (Rate Limit) 或模型暫時停用問題
    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

          if (text) {
            let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanText);
            return NextResponse.json(parsed);
          }
        }

        const errorData = await response.text();
        console.warn(`Gemini model [${model}] failed (${response.status}):`, errorData);
        lastStatus = response.status;
        lastError = response.status === 429 
          ? 'API 呼叫次數過多 (Rate Limit Exceeded)' 
          : `Gemini API Error (${model}): ${response.statusText || response.status}`;

        if (response.status === 429) {
          // 若遇 429 短暫等待 800ms 後降級切換至備用模型
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      } catch (err: any) {
        console.error(`Fetch error for model [${model}]:`, err);
        lastError = err.message || 'Network error';
      }
    }

    return NextResponse.json({ error: lastError || 'All Gemini fallback models failed' }, { status: lastStatus });

  } catch (err: any) {
    console.error('Server error in analyze-sleep:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
