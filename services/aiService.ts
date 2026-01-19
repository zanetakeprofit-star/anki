
import { ZhipuModel } from "../types";

// 智谱 API Key: 由用户提供
const ZHIPU_API_KEY = "c9c38c320b9740e79e8ebc61e677aa91.dqaJqFOH3VFJUEbY";
const ZHIPU_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

/**
 * 步骤 1: 使用视觉模型识别图片内容和荧光标记
 */
export async function performOCR(base64Image: string, model: ZhipuModel = 'glm-4v-plus'): Promise<string> {
  const imageData = base64Image.includes('base64,') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
  
  // 视觉识别必须用带有 'v' 的模型
  const visionModel = model.includes('v') ? model : 'glm-4v-plus';

  const prompt = `
你是医学数字化与视觉分析专家。
【任务】
1. 提取图中所有文字，严格保持逻辑层级。
2. **核心识别**：精准找出被荧光笔（黄/绿/蓝）、红框、下划线标记的内容。
3. 将标记内容包裹在 <mark>标记内容</mark> 标签中。
【结构化要求】
- 如果图中包含表格、流程图或对比列表，请用文字清晰描述其对应关系。
- 只输出识别结果，禁止任何开场白。
  `;

  const response = await fetch(ZHIPU_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ZHIPU_API_KEY}`
    },
    body: JSON.stringify({
      model: visionModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageData } }
          ]
        }
      ],
      stream: false
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OCR 失败: ${error?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

/**
 * 步骤 2: 将标记文本转化为极致美感的 Anki 卡片
 */
export async function generateAnkiCard(rawTextWithTags: string, model: ZhipuModel = 'glm-4-plus'): Promise<{ front: string; back: string }> {
  // 文本处理模型选择
  const textModel = model.includes('v') ? 'glm-4-plus' : model;

  const prompt = `
你是顶级医学教育专家与排版美学家。你现在的任务是处理 OCR 后的医学文本，并将其转化为 Anki 卡片。

【核心排版指令 - 必须严格执行】
1. **多空合并**：一张图只做一张卡。将所有 <mark>内容</mark> 替换为编号填空 (1)____, (2)____。
2. **拒绝 Markdown 表格**：严禁使用 | --- | 这种 Markdown 表格。
3. **强制使用 HTML <table>**：如果涉及对比、解剖层次、药理分类、鉴别诊断，**必须** 使用 HTML <table> 标签。
   - 表格必须包含 <thead>, <tbody>, <tr>, <th>, <td>。
   - 样式要求：给 <table> 加上样式 class="anki-table"。
4. **视觉呼吸感**：
   - 段落之间必须使用 <br><br> 分隔。
   - 标题使用 <b> 或 <h3> 标签。
   - 重要的医学术语使用 <span style="color: #e67e22; font-weight: bold;"> 包裹。

【输出任务】
- **正面 (front)**：包含完整的医学背景描述，将重点挖空。如果原文是表格，正面也要以 HTML 表格呈现，但把重点内容挖空。
- **反面 (back)**：按编号列出答案。提供“老奶奶都能懂”的深度解析（分子->细胞->器官），解析逻辑转折处必须换行。

【输出格式】
必须返回纯 JSON 对象，不要包含任何 Markdown 代码块：
{
  "front": "HTML格式的正面内容",
  "back": "HTML格式的反面内容"
}
  `;

  const response = await fetch(ZHIPU_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ZHIPU_API_KEY}`
    },
    body: JSON.stringify({
      model: textModel,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: rawTextWithTags }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      stream: false
    })
  });

  if (!response.ok) throw new Error(`模型调用失败: ${response.status}`);

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  
  try {
    return JSON.parse(content);
  } catch (e) {
    // 容错处理：去除可能的 Markdown 标记
    const cleaned = content.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  }
}
