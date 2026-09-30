import { runConcierge, conciergeRequestSchema } from '@/server/concierge';
import { getServerRepository } from '@/server/repository';

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = conciergeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Send { "message": string } between 2 and 300 characters.' },
      { status: 400 },
    );
  }

  try {
    return Response.json(await runConcierge(parsed.data.message, { repo: getServerRepository() }));
  } catch (error) {
    console.error('Concierge request failed', error);
    return Response.json({ error: 'The concierge is unavailable right now.' }, { status: 500 });
  }
}
