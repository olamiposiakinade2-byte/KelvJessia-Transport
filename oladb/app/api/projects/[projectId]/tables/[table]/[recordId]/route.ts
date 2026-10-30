import { NextRequest, NextResponse } from 'next/server';
import { requireApiAdministrator, routeError } from '@/lib/route';
import { tableName } from '@/lib/validation';
import { deleteRow, updateRow, type TableName } from '@/lib/tables';

type Context = { params: Promise<{ projectId: string; table: string; recordId: string }> };
async function context(params: Context['params']) { const { projectId, table, recordId } = await params; return { projectId, table: tableName.parse(table) as TableName, recordId }; }

export async function PATCH(request: NextRequest, { params }: Context) {
  const denied = await requireApiAdministrator(); if (denied) return denied;
  try { const { projectId, table, recordId } = await context(params); return NextResponse.json({ row: await updateRow(projectId, table, recordId, await request.json()) }); } catch (error) { return routeError(error); }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const denied = await requireApiAdministrator(); if (denied) return denied;
  try { const { projectId, table, recordId } = await context(params); await deleteRow(projectId, table, recordId); return new NextResponse(null, { status: 204 }); } catch (error) { return routeError(error); }
}
