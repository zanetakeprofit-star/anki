
import { GoogleGenAI } from "@google/genai";

// Use provided hardcoded keys
const DEEPSEEK_API_KEY = "sk-306433a4c53f43459c54ebfdfe5f5ccf";
const GEMINI_API_KEY = "sk-gobdDAJlNQ0KuAVUehO0SR1KjvRy5WnyK0Z4CrrbKQSexHTd";

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export async function performOCR(base64Image: string): Promise<string> {
  const model = "gemini-3-flash-preview";
  const prompt = `
你是顶尖的医学文档数字化专家。
【任务】
精准识别图片中的医学题目、选项及所有标记。
【关键要求】
1. **结构还原**：遇到表格时，必须将其转化为清晰的文本列表，不要把列混在一起。
2. **标记识别**：识别图片中的黄色高亮、红框、下划线位置，并用 {{BLANK}} 替换该处文字。
3. **纯净输出**：只输出识别到的文字内容，不要输出 "这是一张图片" 之类的废话，不要 Markdown 代码块。
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] || base64Image } },
        { text: prompt }
      ]
    }
  });

  const text = response.text;
  if (!text || text.trim().length === 0) {
    throw new Error("OCR 识别结果为空，请确保图片清晰且包含文字。");
  }
  return text.trim();
}

export async function generateAnkiCard(rawText: string): Promise<{ front: string; back: string }> {
  const prompt = `
你是医学 Anki 制作专家。
【任务】
将 OCR 识别出的医学题目转化为适合 Anki 导入的问答对。
【要求】
1. **正面 (front)**：题目全文 + 选项。必须保留 {{BLANK}} 标记。
2. **反面 (back)**：直接给出正确选项及核心答案文字。**严禁** 提供冗长的机制解析、背景知识或“老奶奶”式教学。
3. **排版**：使用 Markdown 加粗核心关键词。段落之间空一行。
【输出限制】
必须且仅能输出纯 JSON 格式（不要 Markdown 代码块包裹），格式如下：
{
  "front": "题目内容...",
  "back": "正确答案..."
}
  `;

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: rawText }
      ],
      response_format: { type: 'json_object' },
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API 错误: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  
  try {
    return JSON.parse(content);
  } catch (e) {
    console.error("DeepSeek JSON Parsing failed", content);
    throw new Error("模型返回的数据格式无法解析为 JSON，请重试。");
  }
}
