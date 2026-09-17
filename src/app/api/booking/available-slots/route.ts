/**
 * API ROUTE: Get available time slots
 *
 * Called by the public booking flow to show open slots for a service on a date.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ServiceId } from '@/features/services/types';
import type { EmployeeId } from '@/features/employees/types';
import type { OrganizationId } from '@/lib/types/common';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationSlug, serviceId, date, employeeId } = body;

    if (!organizationSlug || !serviceId || !date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get organization ID from slug
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', organizationSlug)
      .is('deleted_at', null)
      .maybeSingle();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const organizationId = org.id as OrganizationId;

    // Call the RPC to get available slots
    const { data: slots, error: slotsError } = await supabase.rpc('get_available_slots', {
      p_organization_id: organizationId,
      p_service_id: serviceId as ServiceId,
      p_date: date,
      ...(employeeId && { p_employee_id: employeeId as EmployeeId }),
    });

    if (slotsError) {
      console.error('Failed to get available slots:', slotsError);
      return NextResponse.json(
        { error: 'Failed to load available times' },
        { status: 500 }
      );
    }

    return NextResponse.json({ slots: slots ?? [] });
  } catch (error) {
    console.error('Available slots API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
