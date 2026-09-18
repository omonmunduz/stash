import Link from 'next/link';
import { Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number | null;
    price: number | null;
  };
  orgSlug: string;
}

export function ServiceCard({ service, orgSlug }: ServiceCardProps) {
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours} hr`;
    return `${hours} hr ${remainingMinutes} min`;
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-slate-300">
      <div className="flex flex-1 flex-col p-6 lg:p-8">
        <h3 className="mb-3 text-2xl font-semibold tracking-tight text-slate-900">
          {service.name}
        </h3>

        {service.description && (
          <p className="mb-6 flex-1 text-base leading-relaxed text-slate-600 line-clamp-3">
            {service.description}
          </p>
        )}

        <div className="mt-auto space-y-3">
          {service.duration_minutes && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span>{formatDuration(service.duration_minutes)}</span>
            </div>
          )}

          {service.price !== null && (
            <div className="text-3xl font-bold text-slate-900">
              {formatPrice(service.price)}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 p-6 lg:p-8">
        <Button asChild className="w-full" size="lg">
          <Link href={`/${orgSlug}/book?service=${service.id}`}>
            <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
            Book Now
          </Link>
        </Button>
      </div>
    </article>
  );
}
