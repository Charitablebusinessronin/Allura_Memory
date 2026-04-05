import { NextRequest, NextResponse } from 'next/server';
import { listInsights } from '@/lib/neo4j/client';
import { validateGroupId, GroupIdValidationError } from '@/lib/validation/group-id';

/**
 * GET /api/memory/insights
 * 
 * Query insights with group_id enforcement.
 * Query params:
 * - group_id: Required tenant identifier (format: allura-*)
 * - limit: Max number of insights (default: 50)
 * - status: Insight status filter (active | deprecated | pending)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const group_id_param = searchParams.get('group_id');
    
    // Validate group_id is provided
    if (!group_id_param) {
      return NextResponse.json(
        { error: 'group_id is required. Provide a valid tenant identifier (format: allura-*)' },
        { status: 400 }
      );
    }
    
    // Validate group_id format
    let group_id: string;
    try {
      group_id = validateGroupId(group_id_param);
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        return NextResponse.json(
          { error: `Invalid group_id: ${error.message}` },
          { status: 400 }
        );
      }
      throw error;
    }
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status') as 'active' | 'superseded' | 'deprecated' | 'reverted' | undefined;

    const result = await listInsights({
      group_id,
      limit,
      status,
    });

    return NextResponse.json({ insights: result.items, total: result.total });
  } catch (error) {
    console.error('Failed to fetch insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}