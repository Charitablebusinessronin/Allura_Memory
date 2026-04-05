import { NextRequest, NextResponse } from 'next/server';
import { searchInsights } from '@/lib/neo4j/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const group_id = searchParams.get('group_id') || 'allura-default';
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type');

    const insights = await searchInsights({
      group_id,
      limit,
      type: type as 'pattern' | 'decision' | 'adr' | 'best-practice' | undefined
    });

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('Failed to fetch insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}