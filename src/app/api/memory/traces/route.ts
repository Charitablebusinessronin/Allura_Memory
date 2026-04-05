import { NextRequest, NextResponse } from 'next/server';
import { queryTraces, logTraceToPostgres } from '@/lib/postgres/traces';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const group_id = searchParams.get('group_id') || 'allura-default';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type');

    const traces = await queryTraces({
      group_id,
      limit,
      offset,
      type: type as 'memory' | 'decision' | 'action' | 'prompt' | undefined
    });

    return NextResponse.json({ traces });
  } catch (error) {
    console.error('Failed to fetch traces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch traces' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { group_id, type, content, agent, metadata } = body;

    if (!group_id || !content) {
      return NextResponse.json(
        { error: 'group_id and content are required' },
        { status: 400 }
      );
    }

    const trace = await logTraceToPostgres({
      group_id,
      type: type || 'memory',
      content,
      agent: agent || 'api',
      metadata: metadata || {}
    });

    return NextResponse.json({ success: true, trace });
  } catch (error) {
    console.error('Failed to log trace:', error);
    return NextResponse.json(
      { error: 'Failed to log trace' },
      { status: 500 }
    );
  }
}