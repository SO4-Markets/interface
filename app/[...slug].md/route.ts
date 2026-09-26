import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request, { params }: { params: { slug: string[] } }) {
  try {
    const slugPath = params.slug.join('/');
    const filePath = path.join(process.cwd(), 'content/docs', `${slugPath}.md`);

    if (!fs.existsSync(filePath)) {
      return new NextResponse('Documentation asset not found', { status: 404 });
    }

    const rawMarkdown = fs.readFileSync(filePath, 'utf8');

    // Skip serving if the file is explicitly a draft asset
    if (rawMarkdown.includes('draft: true')) {
      return new NextResponse('Asset unavailable', { status: 403 });
    }

    // Return plain unadulterated text/markdown content without layout chrome wraps
    return new NextResponse(rawMarkdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
      },
    });
  } catch (error) {
    return new NextResponse('Internal Server Processing Error', { status: 500 });
  }
}
