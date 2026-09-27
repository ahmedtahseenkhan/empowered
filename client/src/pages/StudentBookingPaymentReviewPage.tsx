import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Wallet, ShieldCheck } from 'lucide-react';
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
  config: {
    weeksPerBooking: number;
    cancelCutoffHours: number;
    settlementDays: number;
    purchaseMinCredits?: number;
    purchaseMaxCredits?: number;
    purchaseFeePercent?: number;
  };
};

const PENDING_BOOKING_KEY = 'pendingStudentBooking';

const currency = (amount: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount);

const StudentBookingPaymentReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [pending, setPending] = useState<PendingBooking | null>(null);
  const [mentor, setMentor] = useState<PublicTutorLite | null>(null);
  const [quote, setQuote] = useState<CreditsQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [buyBusy, setBuyBusy] = useState(false);
  const [creditsBusy, setCreditsBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
      } catch (e) {
        setError(apiError(e, 'Failed to load mentor.'));
        setMentor(null);
      }
    };
    fetchMentor();
  }, [pending?.tutorId]);

  const refreshQuote = useCallback(async () => {
    if (!pending?.tutorId) return;
    try {
      const res = await api.get('/wallet/quote', { params: { tutorId: pending.tutorId, frequency: pending.frequency } });
      setQuote(res.data || null);
    } catch {
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [pending?.tutorId, pending?.frequency]);

  // Returning from Stripe Checkout: credit the purchase (idempotent with the webhook), then re-quote.
  useEffect(() => {
    if (!pending?.tutorId) return;
    const sessionId = searchParams.get('purchase_session_id');
    (async () => {
      if (sessionId) {
        try {
          await api.post('/wallet/purchase/finalize', { sessionId });
          setNotice('Payment received — your credits have been added. Reserve your sessions below to confirm the booking.');
        } catch (e) {
          setError(apiError(e, 'We could not confirm your purchase automatically. It may take a minute — refresh this page.'));
        } finally {
          searchParams.delete('purchase_session_id');
          setSearchParams(searchParams, { replace: true });
        }
      }
      await refreshQuote();
    })();
  }, [pending?.tutorId, refreshQuote]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstStart = useMemo(() => {
    const starts = (pending?.slotStarts || []).map((s) => new Date(s)).filter((d) => !Number.isNaN(d.getTime()));
    starts.sort((a, b) => a.getTime() - b.getTime());
    return starts[0] || null;
  }, [pending?.slotStarts]);

  const feePercent = quote?.config.purchaseFeePercent ?? 0;
  const minBuy = quote?.config.purchaseMinCredits ?? 10;
  const maxBuy = quote?.config.purchaseMaxCredits ?? 1000;
  const topUpCredits = quote && !quote.sufficient ? Math.max(quote.shortfall, minBuy) : 0;
  const topUpFee = Math.round(topUpCredits * feePercent) / 100;
  const topUpTooLarge = topUpCredits > maxBuy;

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

  const buyTopUp = async () => {
    if (!topUpCredits || topUpTooLarge) return;
    try {
      setBuyBusy(true);
      setError('');
      const reviewUrl = `${window.location.origin}/student/booking/review`;
      const res = await api.post('/wallet/purchase', {
        credits: topUpCredits,
        successUrl: reviewUrl,
        cancelUrl: reviewUrl,
      });
      const url = res.data?.url as string | undefined;
      if (!url) throw new Error('No checkout URL returned');
      window.location.href = url;
    } catch (e) {
      setError(apiError(e, 'Failed to start the credit purchase.'));
      setBuyBusy(false);
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

  const creditsAvailable = !!quote?.enabled && quote.required > 0;
  const busy = buyBusy || creditsBusy;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Review & confirm</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review the booking details and reserve your sessions with Learning Credits.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm">{notice}</div>
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
            {creditsAvailable && quote && (
              <>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <dt className="text-gray-500">Sessions reserved</dt>
                  <dd className="font-medium text-gray-900">{quote.sessions}</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <dt className="text-gray-500">Credits per session</dt>
                  <dd className="font-medium text-gray-900">{quote.creditsPerSession}</dd>
                </div>
              </>
            )}
          </dl>
        </Card>

        {quoteLoading ? (
          <Card>
            <div className="text-sm text-gray-600">Loading your Learning Credits…</div>
          </Card>
        ) : !creditsAvailable || !quote ? (
          <Card>
            <div className="text-sm font-semibold text-gray-900">Learning Credits are unavailable right now</div>
            <p className="text-sm text-gray-600 mt-1">
              Sessions are reserved with Learning Credits, and we couldn't load your credits for this booking. Please try again in a moment or contact support.
            </p>
          </Card>
        ) : (
          <Card className="border-purple-200 ring-1 ring-purple-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700 shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900">Reserve with Learning Credits</div>
                <p className="text-sm text-gray-600 mt-1">
                  Reserves your next <span className="font-medium">{quote.sessions} sessions</span> ({quote.creditsPerSession} credits each, 1 credit = $1).
                  Credits are released to the mentor only after each session is completed.
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

                {!quote.sufficient && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="text-sm font-medium text-amber-900">
                      You need {quote.shortfall} more credit{quote.shortfall === 1 ? '' : 's'} to reserve these sessions.
                    </div>
                    {topUpTooLarge ? (
                      <p className="text-sm text-amber-900 mt-1">
                        A single purchase is limited to {maxBuy} credits. Add credits from your{' '}
                        <Link to="/student/wallet" className="underline font-medium">wallet</Link>, then return here to reserve.
                      </p>
                    ) : (
                      <>
                        <dl className="mt-3 grid grid-cols-1 gap-1 text-sm max-w-sm">
                          <div className="flex justify-between py-1">
                            <dt className="text-gray-700">{topUpCredits} Learning Credits</dt>
                            <dd className="font-medium text-gray-900">{currency(topUpCredits)}</dd>
                          </div>
                          {feePercent > 0 && (
                            <div className="flex justify-between py-1">
                              <dt className="text-gray-700">Platform fee ({feePercent}%)</dt>
                              <dd className="font-medium text-gray-900">{currency(topUpFee)}</dd>
                            </div>
                          )}
                          <div className="flex justify-between py-1 border-t border-amber-200">
                            <dt className="font-semibold text-gray-900">Total charged to card</dt>
                            <dd className="font-semibold text-gray-900">{currency(topUpCredits + topUpFee)}</dd>
                          </div>
                        </dl>
                        {topUpCredits > quote.shortfall && (
                          <p className="text-xs text-gray-600 mt-1">
                            The minimum purchase is {minBuy} credits. Unused credits stay in your wallet and never expire.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/student/book/${pending.tutorId}?frequency=${encodeURIComponent(pending.frequency)}`)}
                    disabled={busy}
                  >
                    Back
                  </Button>
                  {quote.sufficient ? (
                    <Button size="sm" onClick={reserveWithCredits} disabled={busy || !mentor}>
                      <Wallet className="w-4 h-4 mr-2" />
                      {creditsBusy ? 'Reserving…' : `Reserve ${quote.sessions} sessions with ${quote.required} credits`}
                    </Button>
                  ) : !topUpTooLarge ? (
                    <Button size="sm" onClick={buyTopUp} disabled={busy}>
                      {buyBusy ? 'Redirecting…' : `Buy ${topUpCredits} credits`}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>
        )}

        {creditsAvailable && quote && (
          <Card className="bg-purple-50/60 border-purple-100">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-purple-700 mt-0.5 shrink-0" />
              <div className="text-sm text-gray-700">
                <p className="font-semibold text-gray-900">Cancellation & refund policy</p>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>Cancel a session more than {quote.config.cancelCutoffHours} hours before it starts and its credits return to your wallet instantly.</li>
                  <li>Within {quote.config.cancelCutoffHours} hours of the start time, a session can no longer be cancelled for a credit return.</li>
                  <li>If your mentor cancels a session, its credits are returned to your wallet.</li>
                  <li>All refunds are issued as Learning Credits to your EmpowerEd wallet — not as a cash or card refund.</li>
                  <li>Learning Credits can only be used on EmpowerEd Learnings, cannot be withdrawn as cash, and never expire.</li>
                  {feePercent > 0 && <li>The {feePercent}% platform fee on credit purchases is non-refundable.</li>}
                </ul>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentBookingPaymentReviewPage;
