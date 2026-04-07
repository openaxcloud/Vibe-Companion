// @ts-nocheck
import express, { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = express.Router();

function ensureAuthenticated(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

const SYSTEM_PROMPT = `You are an expert code reviewer with 40 years of experience. Analyze code and identify issues, bugs, security vulnerabilities, and improvements. Return ONLY a valid JSON object with this exact structure:
{
  "summary": "Brief overall assessment",
  "score": 85,
  "issues": [
    {
      "id": "unique-id",
      "severity": "error",
      "title": "Issue title",
      "description": "Detailed description",
      "line": 10,
      "endLine": 15,
      "code": "problematic code snippet",
      "fixSuggestion": "how to fix this"
    }
  ]
}
Severity levels: "error" (critical bugs/security), "warning" (quality issues), "suggestion" (improvements).
Return ONLY valid JSON, no markdown, no explanation text.`;

router.post('/analyze', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId, filePath, code, language } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const client = new Anthropic();

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Review this ${language || 'code'} file "${filePath || 'unknown'}":\n\n\`\`\`${language || ''}\n${code.slice(0, 8000)}\n\`\`\``,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let reviewData: { summary: string; score: number; issues: any[] };
    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      reviewData = JSON.parse(jsonMatch ? jsonMatch[0] : content.text);
    } catch {
      reviewData = { summary: content.text.slice(0, 500), score: 75, issues: [] };
    }

    if (projectId) {
      try {
        await db.execute(sql`
          INSERT INTO code_reviews (project_id, reviewer_id, title, description, file_path, status, completed_at)
          VALUES (
            ${parseInt(projectId, 10)},
            ${req.user!.id as number},
            ${'AI Review - ' + (filePath || 'Code Analysis')},
            ${reviewData.summary || ''},
            ${filePath || null},
            ${'completed'},
            ${new Date()}
          )
        `);
      } catch {
        // Non-critical — review result still returned to client
      }
    }

    res.json({
      success: true,
      summary: reviewData.summary,
      score: reviewData.score ?? 75,
      issues: (reviewData.issues || []).map((issue: any, idx: number) => ({
        ...issue,
        id: issue.id || `issue-${idx}-${Date.now()}`,
        projectId,
        filePath: issue.filePath || filePath,
      })),
    });
  } catch (error: any) {
    console.error('[CodeReview] Analyze error:', error);
    res.status(500).json({ error: 'Failed to analyze code', details: error.message });
  }
});

router.get('/current', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.json({ success: true, issues: [] });

    const pid = parseInt(projectId as string, 10);
    if (isNaN(pid)) return res.json({ success: true, issues: [] });

    const result = await db.execute(sql`
      SELECT id, title, description, file_path, status, created_at
      FROM code_reviews
      WHERE project_id = ${pid}
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      issues: (result.rows || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        filePath: r.file_path,
        status: r.status,
        createdAt: r.created_at,
      })),
    });
  } catch (error: any) {
    console.error('[CodeReview] Current error:', error);
    res.status(500).json({ error: 'Failed to fetch current review' });
  }
});

router.get('/issues/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const pid = parseInt(req.params.projectId, 10);
    const limit = parseInt(req.query.limit as string || '50', 10);

    if (isNaN(pid)) return res.status(400).json({ error: 'Invalid project ID' });

    const result = await db.execute(sql`
      SELECT id, title, description, file_path, status, line_start, line_end, created_at
      FROM code_reviews
      WHERE project_id = ${pid}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    res.json({
      success: true,
      issues: (result.rows || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        filePath: r.file_path,
        status: r.status,
        lineStart: r.line_start,
        lineEnd: r.line_end,
        createdAt: r.created_at,
      })),
      total: result.rows?.length || 0,
    });
  } catch (error: any) {
    console.error('[CodeReview] Issues error:', error);
    res.status(500).json({ error: 'Failed to fetch code review issues' });
  }
});

router.get('/report/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const pid = parseInt(req.params.projectId, 10);
    const format = req.query.format || 'json';

    if (isNaN(pid)) return res.status(400).json({ error: 'Invalid project ID' });

    const result = await db.execute(sql`
      SELECT id, title, description, file_path, status, created_at, completed_at
      FROM code_reviews
      WHERE project_id = ${pid}
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const reviews = result.rows || [];
    const report = {
      projectId: pid,
      totalReviews: reviews.length,
      completed: reviews.filter((r: any) => r.status === 'completed').length,
      pending: reviews.filter((r: any) => r.status === 'pending').length,
      reviews: reviews.map((r: any) => ({
        id: r.id,
        title: r.title,
        filePath: r.file_path,
        status: r.status,
        createdAt: r.created_at,
        completedAt: r.completed_at,
      })),
      generatedAt: new Date().toISOString(),
    };

    if (format === 'markdown') {
      const md = `# Code Review Report\n\n**Project ID:** ${pid}\n**Total Reviews:** ${report.totalReviews}\n**Generated:** ${report.generatedAt}\n\n## Reviews\n\n${reviews.map((r: any) => `### ${r.title}\n- Status: ${r.status}\n- File: ${r.file_path || 'N/A'}\n- Date: ${r.created_at}\n\n${r.description || ''}`).join('\n---\n')}`;
      res.setHeader('Content-Type', 'text/markdown');
      return res.send(md);
    }

    res.json({ success: true, report });
  } catch (error: any) {
    console.error('[CodeReview] Report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.post('/fix/:issueId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const issueId = parseInt(req.params.issueId, 10);
    if (isNaN(issueId)) return res.status(400).json({ error: 'Invalid issue ID' });

    await db.execute(sql`
      UPDATE code_reviews SET status = 'completed', completed_at = NOW()
      WHERE id = ${issueId}
    `);

    res.json({ success: true, message: 'Issue marked as resolved' });
  } catch (error: any) {
    console.error('[CodeReview] Fix error:', error);
    res.status(500).json({ error: 'Failed to fix issue' });
  }
});

export default router;
