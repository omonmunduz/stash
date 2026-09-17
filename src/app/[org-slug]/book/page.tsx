/**
 * PUBLIC BOOKING PAGE
 *
 * Guest checkout for appointments. No login required.
 * Route: /[org-slug]/book or /[org-slug]/book?employee=[slug]
 *
 * Flow:
 * 1. Show organization info and service list
 * 2. User selects service (and optionally employee)
 * 3. Show available time slots for selected date
 * 4. Collect name + phone
 * 5. Book appointment via RPC
 */

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BookingFlow } from '@/features/appointments/components/BookingFlow';
import type { OrganizationId } from '@/lib/types/common';

interface BookingPageProps {
  params: Promise<{ 'org-slug': string }>;
  searchParams: Promise<{ employee?: string; service?: string }>;
}

export default async function BookingPage({ params, searchParams }: BookingPageProps) {
  const { 'org-slug': slug } = await params;
  const { employee: employeeSlug } = await searchParams;

  const supabase = await createClient();

  // Load organization by slug
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();

  if (orgError || !org) {
    notFound();
  }

  const organizationId = org.id as OrganizationId;

  // Load services
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name');

  if (servicesError) {
    throw new Error('Failed to load services');
  }

  // Load employees
  const { data: employees, error: employeesError } = await supabase
    .from('employees')
    .select('id, display_name, slug, photo_url, bio')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('display_name');

  if (employeesError) {
    throw new Error('Failed to load employees');
  }

  // If employee slug is provided, filter to that employee
  const preselectedEmployee = employeeSlug
    ? employees.find((e) => e.slug === employeeSlug)
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">{org.name}</h1>
          <p className="mt-2 text-muted-foreground">Book your appointment</p>
        </div>

        {/* Booking form */}
        <BookingFlow
          organizationSlug={org.slug}
          services={services ?? []}
          employees={employees ?? []}
          preselectedEmployee={preselectedEmployee}
        />
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: BookingPageProps) {
  const { 'org-slug': slug } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();

  return {
    title: org ? `Book appointment - ${org.name}` : 'Book appointment',
  };
}
