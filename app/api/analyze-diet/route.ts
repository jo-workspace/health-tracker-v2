import { NextResponse } from 'next/server';

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash'
];

// 明顯非彩虹原型植物食材的黑名單關鍵字
const NON_PLANT_KEYWORDS = [
  '肉', '牛', '豬', '雞', '鴨', '羊', '鵝', '魚', '鮭魚', '鮪魚', '鱈魚', '鯖魚',
  '蝦', '蟹', '蛤', '蚵', '牡蠣', '貝', '花枝', '軟絲', '魷魚', '章魚', '吻仔魚',
  '蛋', '起司', '乳酪', '芝士', '奶油', '牛奶', '優格',
  '貢丸', '魚丸', '肉丸', '花枝丸', '熱狗', '香腸', '火腿', '培根', '甜不辣', '黑輪', '魚板', '蟹肉棒',
  '白飯', '白米飯', '白米', '白麵', '白麵條', '冬粉', '油條',
  '美乃滋', '沙拉醬', '肉燥', '排骨'
];

// 例外清單（雖含上述關鍵字但實質為天然植物）
const PLANT_WHITELIST = new Set([
  '肉桂', '魚腥草', '紫米', '黑米', '糙米', '小米', '紅米', '胚芽米', '玉米', '蛋黃果'
]);

function isPlantFood(name: string): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (PLANT_WHITELIST.has(trimmed)) return true;
  for (const kw of NON_PLANT_KEYWORDS) {
    if (trimmed.includes(kw)) {
      return false;
    }
  }
  return true;
}

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
You are a professional nutrition expert specializing in plant diversity and the Rainbow Diet (e.g., American Gut Project 30 Plants/Week).
I am providing a photo of a meal, dish, or food ingredients.

Your task:
Identify all visible, whole, natural PLANT-BASED foods (vegetables, fruits, whole grains, nuts, seeds, mushrooms, legumes, seaweed, natural herbs/spices).

Categorize each identified plant item into EXACTLY ONE of the following 6 Rainbow Diet colors:
- "red": e.g. 番茄, 蘋果, 草莓, 櫻桃, 紅甜椒, 西瓜, 甜菜根, 枸杞, 蓮霧, 紅豆, etc.
- "orange-yellow": e.g. 胡蘿蔔, 南瓜, 木瓜, 芒果, 香蕉, 地瓜, 柑橘, 黃甜椒, 玉米, 鳳梨, 檸檬, 燕麥, 百香果, etc.
- "green": e.g. 菠菜, 綠花椰菜, 青江菜, 奇異果, 小黃瓜, 蘆筍, 青椒, 芹菜, 芭樂, 高麗菜, 萵苣, 毛豆, 秋葵, 酪梨, 綠葡萄, 香菜, 蔥, etc.
- "blue-purple": e.g. 藍莓, 茄子, 紫甘藍, 葡萄, 桑椹, 紫地瓜, 黑莓, 紫洋蔥, 紫米, 紫山藥, etc.
- "white-brown": e.g. 洋蔥, 大蒜, 白蘿蔔, 菇類 (杏鮑菇/金針菇/蘑菇/香菇), 豆腐, 豆芽 (綠豆芽/黃豆芽), 糙米, 薏仁, 白木耳, 馬鈴薯, 竹筍, 花生, 核桃, 腰果, 杏仁, etc.
- "black": e.g. 黑木耳, 黑豆, 黑芝麻, 黑米, 海帶, 紫菜, 昆布, 奇亞籽, etc.

STRICT EXCLUSION RULES (DO NOT OUTPUT ANY OF THE FOLLOWING):
1. ANIMAL PRODUCTS & SEAFOOD:
   Strictly exclude any meat, poultry, seafood, fish, eggs, dairy, or cheese.
   (e.g., NO 豬肉, 牛肉, 雞肉, 鴨肉, 魚肉, 鮭魚, 蝦, 蛤蜊, 水煮蛋, 荷包蛋, 蛋絲, 鵪鶉蛋, 起司, 芝士, 培根, 火腿, 肉燥, 排骨).
2. PROCESSED FOODS & HOTPOT INGREDIENTS:
   Strictly exclude artificial or processed products.
   (e.g., NO 貢丸, 魚丸, 肉丸, 熱狗, 香腸, 魚板, 甜不辣, 蟹肉棒).
3. REFINED NON-WHOLE STARCHES:
   Strictly exclude refined white starches that lack phytochemicals.
   (e.g., NO 白米飯, 白飯, 純白麵條, 冬粉, 油條, 白吐司).
   *Note: WHOLE grains like 糙米, 紫米, 黑米, 燕麥, 地瓜, 芋頭, 藜麥, 玉米 ARE ALLOWED and encouraged.
4. OILS, DRESSINGS, SUGARS:
   Strictly exclude pure oils, salad dressings, sauces, mayonnaise, sugar.
5. FERMENTED VEGETABLES:
   For kimchi or fermented vegetables (泡菜), identify them by their underlying whole plant (e.g. 大白菜 or 白蘿蔔).

OUTPUT RULES:
- ONLY output genuine plant-based foods that are clearly visible.
- Categorize sprout vegetables (豆芽、綠豆芽、黃豆芽) as vegetables under "white-brown", NOT as bean legumes.
- Use concise Traditional Chinese names (e.g., "綠花椰菜", "胡蘿蔔", "黑木耳", "豆腐", "大蒜", "豆芽").
- Return ONLY a raw, valid JSON object in this format:
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
            if (parsed && Array.isArray(parsed.items)) {
              parsed.items = parsed.items.filter((it: any) => it?.plantName && isPlantFood(it.plantName));
            }
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
