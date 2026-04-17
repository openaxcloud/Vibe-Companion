
import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4", // Use gpt-4 or gpt-3.5-turbo
      messages: messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1000,
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    res.end();
  } catch (error) {
    console.error('Error in OpenAI chat stream:', error);
    res.status(500).json({ error: 'Failed to get response from OpenAI' });
  }
});

// Placeholder for document upload processing
app.post('/api/upload-document', (req, res) => {
  // In a real application, you would handle file uploads here,
  // process the document (chunking, embedding), and store it in a vector database.
  console.log('Document upload endpoint hit. (Placeholder)');
  res.status(200).json({ message: 'Document processing initiated (placeholder).' });
});

// Placeholder for code execution
app.post('/api/execute-code', (req, res) => {
  const { code, language } = req.body;
  // In a real application, you would send this code to a sandboxed environment
  // for execution and return the output.
  console.log(`Code execution endpoint hit for ${language}. (Placeholder)`);
  console.log('Code:', code);
  res.status(200).json({ output: 'Code executed successfully (placeholder result).' });
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
