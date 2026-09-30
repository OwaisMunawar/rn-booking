import { formatDuration, formatPrice } from '@rn-booking/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Card, PageHeader, buttonClass } from '@/components/ui';
import { DeleteButton } from '@/features/providers/delete-button';
import { ProviderForm } from '@/features/providers/provider-form';
import { ServiceForm } from '@/features/providers/service-form';
import { deleteProvider, deleteService } from '@/server/actions/catalog';
import { canManageProvider, isAdmin } from '@/server/authz';
import { getRepository } from '@/server/repository';
import { requireSession } from '@/server/session';

export const metadata: Metadata = { title: 'Provider' };

export default async function ProviderPage({ params }: PageProps<'/providers/[id]'>) {
  const { id } = await params;
  const session = await requireSession();
  // Unknown and not-yours look the same, so ids cannot be probed.
  if (!canManageProvider(session, id)) notFound();

  const repo = await getRepository();
  const [provider, services] = await Promise.all([
    repo.getProvider(id),
    repo.listServices({ providerId: id, includeInactive: true }),
  ]);
  if (!provider) notFound();

  return (
    <>
      <PageHeader
        title={provider.name}
        description={`${provider.neighborhood} · ${provider.timeZone}`}
        actions={
          <Link
            href={`/providers/${provider.id}/availability`}
            className={buttonClass('secondary')}
          >
            Weekly hours
          </Link>
        }
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-medium">Listing</h2>
          <ProviderForm provider={provider} />
        </Card>

        <Card>
          <h2 className="mb-1 font-medium">Services</h2>
          <p className="mb-4 text-sm text-zinc-500">
            Buffer is clean-up time after each appointment. It blocks the calendar but is not
            billed.
          </p>
          <div className="space-y-3">
            {services.map((service) => (
              <details key={service.id} className="group rounded-lg border border-zinc-200">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">
                    {service.name}
                    {service.isActive ? null : (
                      <span className="ml-2 text-xs text-zinc-500">(hidden)</span>
                    )}
                  </span>
                  <span className="tabular-nums text-zinc-600">
                    {formatDuration(service.durationMinutes)} + {service.bufferMinutes} min ·{' '}
                    {formatPrice(service.priceCents)}
                  </span>
                </summary>
                <div className="space-y-4 border-t border-zinc-200 p-4">
                  <ServiceForm
                    providerId={provider.id}
                    category={provider.category}
                    service={service}
                  />
                  <DeleteButton
                    id={service.id}
                    label="Delete service"
                    confirmText={`Delete ${service.name}? Services with bookings can only be hidden.`}
                    action={deleteService}
                  />
                </div>
              </details>
            ))}
          </div>
          <div className="mt-6 border-t border-zinc-200 pt-5">
            <h3 className="mb-3 text-sm font-medium">Add a service</h3>
            <ServiceForm
              key={services.length}
              providerId={provider.id}
              category={provider.category}
            />
          </div>
        </Card>

        {isAdmin(session) ? (
          <Card>
            <h2 className="mb-1 font-medium">Danger zone</h2>
            <p className="mb-4 text-sm text-zinc-500">
              Providers with booking history cannot be deleted. Untick &ldquo;Listed in the
              app&rdquo; instead.
            </p>
            <DeleteButton
              id={provider.id}
              label="Delete provider"
              confirmText={`Delete ${provider.name} and all its services?`}
              action={deleteProvider}
            />
          </Card>
        ) : null}
      </div>
    </>
  );
}
