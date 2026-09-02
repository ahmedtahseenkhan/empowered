import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, CreditCard } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import api from '../api/axios';

const apiError = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

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

type CreditsQuote = {
  enabled: boolean;
  creditsPerSession: number;
  sessions: number;
  required: number;
  available: number;
  sufficient: boolean;
  shortfall: number;
  config: { weeksPerBooking: number; cancelCutoffHours: number; settlementDays: number };
};

const PENDING_BOOKING_KEY = 'pendingStudentBooking';
const PLATFORM_FEE_PERCENTAGE = 0.1;

const currency = (amount: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount);

const StudentBookingPaymentReviewPage: React.FC = () => {
  const navigate = useNavigate();

  const [pending, setPending] = useState<PendingBooking | null>(null);
  const [mentor, setMentor] = useState<PublicTutorLite | null>(null);
  const [quote, setQuote] = useState<CreditsQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [creditsBusy, setCreditsBusy] = useState(false);
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

  // Learning Credits quote (non-fatal: if the wallet is unavailable, the card flow still works)
  useEffect(() => {
    if (!pending?.tutorId) return;
    api.get('/wallet/quote', { params: { tutorId: pending.tutorId, frequency: pending.frequency } })
      .then((res) => setQuote(res.data || null))
      .catch(() => setQuote(null));
  }, [pending?.tutorId, pending?.frequency]);

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

  const reserveWithCredits = async () => {
    if (!pending || !mentor || !quote?.sufficient) return;
    try {
      setCreditsBusy(true);
      setError('');
      const res = await api.post('/wallet/bookings', {
        tutorId: mentor.id,
        frequency: pending.frequency,
        slotStarts: pending.slotStarts,
        durationMinutes: pending.durationMinutes,
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const bookingId = res.data?.booking?.id as string | undefined;
      sessionStorage.removeItem(PENDING_BOOKING_KEY);
      navigate(`/student/booking/confirmation?credits=1${bookingId ? `&bookingId=${encodeURIComponent(bookingId)}` : ''}`);
    } catch (e) {
      setError(apiError(e, 'Failed to reserve sessions with credits.'));
    } finally {
      setCreditsBusy(false);
    }
  };

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
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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

  const showCredits = !!quote?.enabled && quote.required > 0;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Review & confirm</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review the booking details and choose how you'd like to pay.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <Card>
          <div className="text-sm font-semibold text-gray-900 mb-3">Session details</div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <dt className="text-gray-500">Mentor</dt>
              <dd className="font-medium text-gray-900">{mentor?.username || '—'}</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <dt className="text-gray-500">First session</dt>
              <dd className="font-medium text-gray-900">
                {firstStart
                  ? firstStart.toLocaleDateString(undefined, { timeZone: studentTimezone, weekday: 'short', month: 'short', day: 'numeric' })
                  : '—'}
                {firstStart ? `, ${firstStart.toLocaleTimeString(undefined, { timeZone: studentTimezone, hour: 'numeric', minute: '2-digit', hour12: true })}` : ''}
              </dd>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <dt className="text-gray-500">Duration</dt>
              <dd className="font-medium text-gray-900">{pending.durationMinutes} minutes</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <dt className="text-gray-500">Frequency</dt>
              <dd className="font-medium text-gray-900">{pending.frequency === 'TWICE_WEEKLY' ? 'Twice weekly' : 'Weekly'}</dd>
            </div>
          </dl>
        </Card>

        {showCredits && quote && (
          <Card className={quote.sufficient ? 'border-purple-200 ring-1 ring-purple-100' : ''}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700 shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-gray-900">Reserve with Learning Credits</div>
                  {quote.sufficient && (
                    <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">Recommended</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Reserves your next <span className="font-medium">{quote.sessions} sessions</span> ({quote.creditsPerSession} credits each).
                  Credits are only released to the mentor after each session is completed, and any session you cancel more than{' '}
                  {quote.config.cancelCutoffHours} hours ahead returns its credits to your wallet instantly.
                </p>
                <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <dt className="text-xs text-gray-500">Credits required</dt>
                    <dd className="font-semibold text-gray-900">{quote.required}</dd>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <dt className="text-xs text-gray-500">Your available credits</dt>
                    <dd className="font-semibold text-gray-900">{quote.available}</dd>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <dt className="text-xs text-gray-500">After reserving</dt>
                    <dd className={`font-semibold ${quote.sufficient ? 'text-gray-900' : 'text-red-600'}`}>
                      {quote.sufficient ? quote.available - quote.required : `${quote.shortfall} short`}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4">
                  {quote.sufficient ? (
                    <Button size="sm" onClick={reserveWithCredits} disabled={creditsBusy || busy || !mentor}>
                      <Wallet className="w-4 h-4 mr-2" />
                      {creditsBusy ? 'Reserving…' : `Reserve ${quote.sessions} sessions with ${quote.required} credits`}
                    </Button>
                  ) : (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      You need {quote.shortfall} more credits to reserve these sessions. Contact the EmpowerEd team to top up your wallet, or pay per session by card below.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900">{showCredits ? 'Or pay per session by card' : 'Pay by card'}</div>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-sm max-w-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <dt className="text-gray-500">Session amount</dt>
                  <dd className="font-medium text-gray-900">{currency(sessionAmount)}</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <dt className="text-gray-500">Platform fee (10%)</dt>
                  <dd className="font-medium text-gray-900">{currency(platformFee)}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-gray-900 font-semibold">Total payable today</dt>
                  <dd className="text-gray-900 font-semibold">{currency(totalPayable)}</dd>
                </div>
              </dl>
              <p className="text-xs text-gray-500 mt-2">
                You are charged today for the <span className="font-medium">first session only</span>. Upcoming sessions are paid separately (pay‑per‑session).
              </p>
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/student/book/${pending.tutorId}?frequency=${encodeURIComponent(pending.frequency)}`)}
                  disabled={busy || creditsBusy}
                >
                  Back
                </Button>
                <Button size="sm" variant={showCredits && quote?.sufficient ? 'outline' : 'primary'} onClick={continueToStripe} disabled={busy || creditsBusy || !mentor}>
                  {busy ? 'Redirecting…' : 'Pay with card via Stripe'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentBookingPaymentReviewPage;
