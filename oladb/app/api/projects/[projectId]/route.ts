import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projectInput } from '@/lib/validation';
import { requireApiAdministrator, routeError } from '@/lib/route';

type Context = { params: Promise<{ projectId: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const denied = await requireApiAdministrator(); if (denied) return denied;
  try { const project = await db.project.update({ where: { id: (await params).projectId }, data: projectInput.partial().parse(await request.json()) }); return NextResponse.json({ project }); } catch (error) { return routeError(error); }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const denied = await requireApiAdministrator(); if (denied) return denied;
  try { await db.project.delete({ where: { id: (await params).projectId } }); return new NextResponse(null, { status: 204 }); } catch (error) { return routeError(error); }
}
