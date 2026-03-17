import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import api from '../api/axios';

type Frequency = 'WEEKLY' | 'TWICE_WEEKLY';

type PendingBooking = {
  tutorId: string;
  frequency: Frequency;
  slotStarts: string[];
  durationMinutes: number;
  createdAt: string;
};

type PublicTutorLite = {
  id: string;
  username: string;
  hourly_rate: number;
  timezone: string;
};

const PENDING_BOOKING_KEY = 'pendingStudentBooking';
const PLATFORM_FEE_PERCENTAGE = 0.1;

const currency = (amount: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount);

const StudentBookingPaymentReviewPage: React.FC = () => {
  const navigate = useNavigate();

  const [pending, setPending] = useState<PendingBooking | null>(null);
  const [mentor, setMentor] = useState<PublicTutorLite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const studentTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_BOOKING_KEY);
      if (!raw) {
        setPending(null);
        return;
      }
      const parsed = JSON.parse(raw) as { tutorId?: string; frequency?: string; slotStarts?: string[]; durationMinutes?: number; createdAt?: string };
      if (!parsed?.tutorId || !parsed?.frequency || !Array.isArray(parsed.slotStarts) || !parsed.slotStarts.length) {
        setPending(null);
        return;
      }
      const frequency: Frequency = parsed.frequency === 'TWICE_WEEKLY' ? 'TWICE_WEEKLY' : 'WEEKLY';
      setPending({ ...parsed, frequency } as PendingBooking);
    } catch {
      setPending(null);
    }
  }, []);

  useEffect(() => {
    const fetchMentor = async () => {
      if (!pending?.tutorId) return;
      try {
        const res = await api.get(`/tutor/public/${pending.tutorId}`);
        const m = res.data?.mentor;
        if (!m) throw new Error('Mentor not found');
        setMentor({
          id: m.id,
          username: m.username,
          hourly_rate: m.hourly_rate,
          timezone: m.timezone || 'UTC',
        });
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Failed to load mentor.');
        setMentor(null);
      }
    };
    fetchMentor();
  }, [pending?.tutorId]);

  const firstStart = useMemo(() => {
    const starts = (pending?.slotStarts || []).map((s) => new Date(s)).filter((d) => !Number.isNaN(d.getTime()));
    starts.sort((a, b) => a.getTime() - b.getTime());
    return starts[0] || null;
  }, [pending?.slotStarts]);

  const sessionAmount = useMemo(() => {
    const rate = Number(mentor?.hourly_rate || 0);
    // Backend currently charges tutor.hourly_rate for a session (duration defaults to 60).
    return rate;
  }, [mentor?.hourly_rate]);

  const platformFee = useMemo(() => sessionAmount * PLATFORM_FEE_PERCENTAGE, [sessionAmount]);
  const totalPayable = useMemo(() => sessionAmount + platformFee, [sessionAmount, platformFee]);

  const continueToStripe = async () => {
    if (!pending || !mentor) return;
    try {
      setBusy(true);
      setError('');

      const baseUrl = window.location.origin;
      const successUrl = `${baseUrl}/student/booking/confirmation`;
      const cancelUrl = `${baseUrl}/student/booking/review`;

      const res = await api.post('/payments/student/booking', {
        tutorId: mentor.id,
        frequency: pending.frequency,
        slotStarts: pending.slotStarts,
        durationMinutes: pending.durationMinutes,
        successUrl,
        cancelUrl,
      });

      const url = res.data?.url as string | undefined;
      if (!url) throw new Error('No Stripe URL returned');

      // Once we redirect to Stripe, clear the pending object.
      sessionStorage.removeItem(PENDING_BOOKING_KEY);
      window.location.href = url;
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to start payment.');
    } finally {
      setBusy(false);
    }
  };

  if (!pending) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <Card>
            <div className="text-lg font-semibold text-gray-900">No booking to review</div>
            <p className="text-sm text-gray-600 mt-1">
              Please pick a mentor and select your preferred time slot(s) again.
            </p>
            <div className="mt-4">
              <Button size="sm" variant="outline" onClick={() => navigate('/student/mentors')}>
                Back to mentors
              </Button>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Review & confirm payment</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review the booking details and charges before paying via Stripe.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-semibold text-gray-900 mb-3">Session details</div>
              <dl className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <dt className="text-gray-500">Mentor</dt>
                  <dd className="font-medium text-gray-900">{mentor?.username || '—'}</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <dt className="text-gray-500">Date</dt>
                  <dd className="font-medium text-gray-900">
                    {firstStart
                      ? firstStart.toLocaleDateString(undefined, {
                          timeZone: studentTimezone,
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '—'}
                  </dd>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <dt className="text-gray-500">Time</dt>
                  <dd className="font-medium text-gray-900">
                    {firstStart
                      ? firstStart.toLocaleTimeString(undefined, {
                          timeZone: studentTimezone,
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })
                      : '—'}
                  </dd>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <dt className="text-gray-500">Duration</dt>
                  <dd className="font-medium text-gray-900">{pending.durationMinutes} minutes</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-gray-500">Frequency</dt>
                  <dd className="font-medium text-gray-900">{pending.frequency}</dd>
                </div>
              </dl>
            </div>

            <div>
              <div className="text-sm font-semibold text-gray-900 mb-3">Charges (today)</div>
              <dl className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <dt className="text-gray-500">Session amount</dt>
                  <dd className="font-medium text-gray-900">{currency(sessionAmount)}</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <dt className="text-gray-500">Platform fee (10%)</dt>
                  <dd className="font-medium text-gray-900">{currency(platformFee)}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-gray-900 font-semibold">Total payable</dt>
                  <dd className="text-gray-900 font-semibold">{currency(totalPayable)}</dd>
                </div>
              </dl>
              <p className="text-xs text-gray-500 mt-3">
                You are charged today for the <span className="font-medium">first session only</span>. Upcoming sessions are paid separately (pay‑per‑session).
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/student/book/${pending.tutorId}?frequency=${encodeURIComponent(pending.frequency)}`)}
              disabled={busy}
            >
              Back
            </Button>
            <Button size="sm" onClick={continueToStripe} disabled={busy || !mentor}>
              {busy ? 'Redirecting…' : 'Confirm & pay with Stripe'}
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentBookingPaymentReviewPage;

