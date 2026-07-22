import { NextResponse } from 'next/server';

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash'
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
You are a professional nutrition expert. I am providing a photo of a meal, dish, or food ingredients.
Identify all visible plant-based foods (vegetables, fruits, grains, nuts, seeds, mushrooms, legumes, seaweed, herbs).
Categorize each identified plant item into EXACTLY ONE of the following 6 Rainbow Diet colors:
- "red": e.g. 番茄, 蘋果, 草莓, 櫻桃, 紅甜椒, 西瓜, 甜菜根, 枸杞, 蓮霧, 紅豆, etc.
- "orange-yellow": e.g. 胡蘿蔔, 南瓜, 木瓜, 芒果, 香蕉, 地瓜, 柑橘, 黃甜椒, 玉米, 鳳梨, 檸檬, 燕麥, 百香果, etc.
- "green": e.g. 菠菜, 綠花椰菜, 青江菜, 奇異果, 小黃瓜, 蘆筍, 青椒, 芹菜, 芭樂, 高麗菜, 萵苣, 毛豆, 秋葵, 酪梨, 綠葡萄, 香菜, 蔥, etc.
- "blue-purple": e.g. 藍莓, 茄子, 紫甘藍, 葡萄, 桑椹, 紫地瓜, 黑莓, 紫洋蔥, 紫米, 紫山藥, etc.
- "white-brown": e.g. 洋蔥, 大蒜, 白蘿蔔, 菇類 (杏鮑菇/金針菇/蘑菇/香菇), 豆腐, 糙米, 薏仁, 白木耳, 馬鈴薯, 竹筍, 花生, 核桃, 腰果, 杏仁, etc.
- "black": e.g. 黑木耳, 黑豆, 黑芝麻, 黑米, 海帶, 紫菜, 昆布, 奇亞籽, etc.

Rules:
1. Ignore animal products (meat, poultry, seafood, eggs, milk, cheese, plain oils/butter).
2. ONLY output plant-based foods.
3. Use concise Traditional Chinese names (e.g., "綠花椰菜", "胡蘿蔔", "黑木耳").
4. Return ONLY a raw, valid JSON object in this format:
{
  "items": [
    { "plantName": "綠花椰菜", "color": "green" },
    { "plantName": "番茄", "color": "red" }
  ]
}
Do NOT wrap with markdown syntax or extra explanation.
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
        temperature: 0.2,
      }
    };

    let lastError = '';
    let lastStatus = 500;

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
        console.warn(`Gemini diet analysis model [${model}] failed (${response.status}):`, errorData);
        lastStatus = response.status;
        lastError = response.status === 429 
          ? 'API 呼叫次數過多 (Rate Limit Exceeded)' 
          : `Gemini API Error (${model}): ${response.statusText || response.status}`;

        if (response.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      } catch (err: any) {
        console.error(`Fetch error for model [${model}]:`, err);
        lastError = err.message || 'Network error';
      }
    }

    return NextResponse.json({ error: lastError || 'All Gemini fallback models failed' }, { status: lastStatus });

  } catch (err: any) {
    console.error('Server error in analyze-diet:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
