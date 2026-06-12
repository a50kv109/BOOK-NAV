import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const upload = multer({ dest: 'uploads/' });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  let genAI: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  const prompt = `
Ты — эксперт-инженер КБ. Проанализируй PDF и верни JSON с двумя объектами:
{
  "nav": {
    "title": "Название",
    "passport": "- Автор: ...\n- Год: ...\n- Страниц: ...",
    "key_topics": ["тема1"],
    "what_to_find": ["[стр. X] ..."],
    "structure": "Список глав",
    "formulas_tables": "Формулы и таблицы",
    "value": "Ценность",
    "notes": "Примечания"
  },
  "utility": {
    "recommendation_score": 9.2,
    "confidence": 0.9,
    "best_used_for": ["устойчивость", "изгиб"],
    "not_recommended_for": ["композиты"],
    "role_utility": { "student": 9, "kb_designer": 10 },
    "verdict": "Рекомендация"
  }
}`;

  function buildNav(d: any): string {
    return `# ${d.title}\n\n## Паспорт\n${d.passport}\n\n## Темы\n${d.key_topics?.join('\n')}\n\n## Что искать\n${d.what_to_find?.join('\n')}\n\n## Структура\n${d.structure}\n\n## Ресурсы\n${d.formulas_tables}\n\n## Ценность\n${d.value}`;
  }

  function buildUtility(d: any): string {
    return `# Utility Profile\n\nScore: ${d.recommendation_score}/10\nConfidence: ${d.confidence}\n\n## BEST_USED_FOR\n${d.best_used_for?.join('\n')}\n\n## NOT_RECOMMENDED_FOR\n${d.not_recommended_for?.join('\n')}\n\n## Вердикт\n${d.verdict}`;
  }

  app.post('/api/books/:id/generate', async (req, res) => {
    if (!genAI) return res.status(500).json({ error: 'No API Key' });
    const { id } = req.params;
    const dir = path.join(process.cwd(), 'library', id);
    try {
      const pdfData = await fs.readFile(path.join(dir, 'book.pdf'));
      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { data: pdfData.toString("base64"), mimeType: "application/pdf" } }]}],
        config: { responseMimeType: "application/json" }
      });
      const parsed = JSON.parse(response.text || "{}");
      await fs.writeFile(path.join(dir, 'nav.md'), buildNav(parsed.nav || {}));
      await fs.writeFile(path.join(dir, 'utility.md'), buildUtility(parsed.utility || {}));
      res.json({ status: 'READY' });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/books/upload', upload.single('pdf'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const id = 'book_' + Date.now();
    const dir = path.join(process.cwd(), 'library', id);
    await fs.mkdir(dir, { recursive: true });
    await fs.rename(req.file.path, path.join(dir, 'book.pdf'));
    res.json({ success: true, bookId: id });
  });

  app.get('/api/books/:id/download-nav', (req, res) => res.download(path.join(process.cwd(), 'library', req.params.id, 'nav.md')));
  app.get('/api/books/:id/download-utility', (req, res) => res.download(path.join(process.cwd(), 'library', req.params.id, 'utility.md')));

  app.listen(PORT, "0.0.0.0", () => console.log('Server running'));
}
startServer();