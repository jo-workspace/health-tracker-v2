import { NextResponse } from 'next/server';

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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API Error:', errorData);
      return NextResponse.json({ error: `Gemini API Error: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return NextResponse.json({ error: 'No text returned from Gemini' }, { status: 500 });
    }

    let parsed;
    try {
      // Strip markdown code blocks if the model accidentally included them
      let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanText);
    } catch (err) {
      console.error('Failed to parse JSON from Gemini:', text);
      return NextResponse.json({ error: 'Failed to parse JSON', rawText: text }, { status: 500 });
    }

    return NextResponse.json(parsed);

  } catch (err: any) {
    console.error('Server error in analyze-sleep:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
