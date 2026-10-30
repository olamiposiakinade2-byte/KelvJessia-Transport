import { NextRequest, NextResponse } from 'next/server';
import { requireApiAdministrator, routeError } from '@/lib/route';
import { tableName } from '@/lib/validation';
import { createRow, listRows, type TableName } from '@/lib/tables';

type Context = { params: Promise<{ projectId: string; table: string }> };
async function context(params: Context['params']) { const { projectId, table } = await params; return { projectId, table: tableName.parse(table) as TableName }; }

export async function GET(_request: NextRequest, { params }: Context) {
  const denied = await requireApiAdministrator(); if (denied) return denied;
  try { const { projectId, table } = await context(params); return NextResponse.json({ rows: await listRows(projectId, table) }); } catch (error) { return routeError(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  const denied = await requireApiAdministrator(); if (denied) return denied;
  try { const { projectId, table } = await context(params); return NextResponse.json({ row: await createRow(projectId, table, await request.json()) }, { status: 201 }); } catch (error) { return routeError(error); }
}
