/**
 * API ROUTE: Book appointment (public)
 *
 * Guest checkout: creates appointment with just name + phone.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ServiceId } from '@/features/services/types';
import type { EmployeeId } from '@/features/employees/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      organizationSlug,
      serviceId,
      employeeId,
      date,
      time,
      customerName,
      customerPhone,
      notes,
    } = body;

    // Validation
    if (!organizationSlug || !serviceId || !date || !time || !customerName || !customerPhone) {
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

    // Call the booking RPC
    const { data: appointmentId, error: bookError } = await supabase.rpc('book_appointment', {
      p_organization_id: org.id,
      p_service_id: serviceId as ServiceId,
      ...(employeeId && { p_employee_id: employeeId as EmployeeId }),
      p_appointment_date: date,
      p_start_time: time,
      p_customer_name: customerName.trim(),
      p_customer_phone: customerPhone.trim(),
      p_notes: notes?.trim() || null,
      p_source: 'public_booking',
    });

    if (bookError) {
      console.error('Booking error:', bookError);

      // Return user-friendly error messages
      if (bookError.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Service or employee not found' },
          { status: 404 }
        );
      }

      if (bookError.message.includes('no longer available')) {
        return NextResponse.json(
          { error: 'This time slot is no longer available. Please select another time.' },
          { status: 409 }
        );
      }

      if (bookError.message.includes('not offer this service')) {
        return NextResponse.json(
          { error: 'This employee does not offer this service.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: bookError.message || 'Failed to book appointment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      appointmentId,
    });
  } catch (error) {
    console.error('Book appointment API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
