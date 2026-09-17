/**
 * BOOKING FLOW COMPONENT
 *
 * Multi-step public booking form:
 * 1. Select service
 * 2. Select date
 * 3. Select time slot (and optionally specific employee)
 * 4. Enter name + phone
 * 5. Confirm and book
 *
 * Client component for interactivity.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, User, Phone, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatMoney } from '@/lib/utils/format';
import type { ServiceId } from '@/features/services/types';
import type { EmployeeId } from '@/features/employees/types';

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
}

interface Employee {
  id: string;
  display_name: string;
  slug: string;
  photo_url: string | null;
  bio: string | null;
}

interface BookingFlowProps {
  organizationSlug: string;
  services: Service[];
  employees: Employee[];
  preselectedEmployee?: Employee;
}

type Step = 'service' | 'datetime' | 'details' | 'confirm';

export function BookingFlow({
  organizationSlug,
  services,
  employees,
  preselectedEmployee,
}: BookingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('service');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    preselectedEmployee ?? null
  );
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Available slots state
  const [availableSlots, setAvailableSlots] = useState<
    Array<{ employee_id: string; employee_name: string; available_times: string[] }>
  >([]);

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setStep('datetime');
    setError(null);
  };

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date);
    setLoading(true);
    setError(null);

    try {
      // Fetch available slots
      const response = await fetch('/api/booking/available-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationSlug,
          serviceId: selectedService!.id,
          date,
          employeeId: selectedEmployee?.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to load available times');
      }

      const data = await response.json();
      setAvailableSlots(data.slots ?? []);

      if (data.slots.length === 0) {
        setError('No availability on this date. Please try another day.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load available times');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeSelect = (time: string, employeeId: string) => {
    setSelectedTime(time);
    if (!selectedEmployee) {
      const employee = employees.find((e) => e.id === employeeId);
      setSelectedEmployee(employee ?? null);
    }
    setStep('details');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Please enter your name and phone number');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/booking/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationSlug,
          serviceId: selectedService!.id,
          employeeId: selectedEmployee!.id,
          date: selectedDate,
          time: selectedTime,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to book appointment');
      }

      const data = await response.json();
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Select service
  if (step === 'service') {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Choose a service</h2>
        {services.length === 0 ? (
          <Alert>
            <AlertDescription>No services available at this time.</AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((service) => (
              <Card
                key={service.id}
                className="cursor-pointer transition-colors hover:border-primary"
                onClick={() => handleServiceSelect(service)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  <CardDescription>
                    {service.duration_minutes} min · {formatMoney(service.price)}
                  </CardDescription>
                </CardHeader>
                {service.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Step 2: Select date and time
  if (step === 'datetime') {
    const today = new Date().toISOString().split('T')[0];
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60);
    const maxDateStr = maxDate.toISOString().split('T')[0];

    return (
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => setStep('service')}>
            ← Back to services
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{selectedService!.name}</CardTitle>
            <CardDescription>
              {selectedService!.duration_minutes} min · {formatMoney(selectedService!.price)}
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-4">
          <div>
            <Label htmlFor="date">Select a date</Label>
            <Input
              id="date"
              type="date"
              min={today}
              max={maxDateStr}
              value={selectedDate}
              onChange={(e) => handleDateSelect(e.target.value)}
              className="mt-1"
            />
          </div>

          {loading && <p className="text-sm text-muted-foreground">Loading available times...</p>}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {selectedDate && availableSlots.length > 0 && (
            <div className="space-y-4">
              <Label>Select a time</Label>
              {availableSlots.map((slot) => (
                <div key={slot.employee_id} className="space-y-2">
                  {!preselectedEmployee && (
                    <p className="text-sm font-medium">{slot.employee_name}</p>
                  )}
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slot.available_times.map((time) => (
                      <Button
                        key={time}
                        variant="outline"
                        onClick={() => handleTimeSelect(time.slice(0, 5), slot.employee_id)}
                      >
                        {time.slice(0, 5)}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 3: Enter customer details
  if (step === 'details') {
    return (
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => setStep('datetime')}>
            ← Back to date & time
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your appointment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <span>{new Date(selectedDate).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span>{selectedTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" />
              <span>{selectedEmployee?.display_name}</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Your name *</Label>
            <Input
              id="name"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Full name"
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone number *</Label>
            <Input
              id="phone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests?"
              className="mt-1"
              rows={3}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? 'Booking...' : 'Confirm booking'}
          </Button>
        </div>
      </div>
    );
  }

  // Step 4: Confirmation
  if (step === 'confirm') {
    return (
      <Card>
        <CardHeader>
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Check className="size-6 text-primary" />
          </div>
          <CardTitle className="text-center">Booking confirmed!</CardTitle>
          <CardDescription className="text-center">
            We've received your appointment request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service</span>
              <span className="font-medium">{selectedService!.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">
                {new Date(selectedDate).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">{selectedTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">With</span>
              <span className="font-medium">{selectedEmployee?.display_name}</span>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              A confirmation will be sent to {customerPhone}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return null;
}
