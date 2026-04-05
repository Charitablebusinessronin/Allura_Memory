import { NextRequest, NextResponse } from 'next/server';
import { queryTraces, logTraceToPostgres } from '@/lib/postgres/traces';
import { validateGroupId, GroupIdValidationError } from '@/lib/validation/group-id';

/**
 * GET /api/memory/traces
 * 
 * Query traces with group_id enforcement.
 * Query params:
 * - group_id: Required tenant identifier (format: allura-*)
 * - limit: Max number of traces (default: 50)
 * - offset: Pagination offset (default: 0)
 * - type: Trace type filter (memory | decision | action | prompt)
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

/**
 * POST /api/memory/traces
 * 
 * Log a trace with group_id enforcement.
 * Body:
 * - group_id: Required tenant identifier (format: allura-*)
 * - type: Trace type (memory | decision | action | prompt)
 * - content: Trace content (required)
 * - agent: Agent identifier (default: 'api')
 * - metadata: Optional metadata object
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { group_id, type, content, agent, metadata } = body;

    // Validate group_id is provided
    if (!group_id) {
      return NextResponse.json(
        { error: 'group_id is required. Provide a valid tenant identifier (format: allura-*)' },
        { status: 400 }
      );
    }

    // Validate group_id format
    let validatedGroupId: string;
    try {
      validatedGroupId = validateGroupId(group_id);
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        return NextResponse.json(
          { error: `Invalid group_id: ${error.message}` },
          { status: 400 }
        );
      }
      throw error;
    }

    if (!content) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      );
    }

    const trace = await logTraceToPostgres({
      group_id: validatedGroupId,
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