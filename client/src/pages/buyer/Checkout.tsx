import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { ordersApi } from '../../api/orders.api';
import { resolveMediaUrl } from '../../api/media';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import { TextArea } from '../../components/shared/TextArea';
import { Spinner } from '../../components/shared/Spinner';
import { MarketplaceNav } from '../../components/marketplace/MarketplaceNav';

const checkoutSchema = z
  .object({
    name: z.string().min(2, 'Name is required'),
    phone: z.string().min(10, 'Valid phone number is required'),
    deliveryMethod: z.enum(['PICKUP', 'DELIVERY']),
    deliveryLocation: z.string().optional(),
    paymentMethod: z.enum(['CASH_ON_DELIVERY', 'PAY_ON_PICKUP', 'SIMULATED_MOMO']),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.deliveryMethod === 'DELIVERY' && (!data.deliveryLocation || data.deliveryLocation.trim() === '')) {
        return false;
      }
      return true;
    },
    {
      message: 'Delivery location is required for delivery',
      path: ['deliveryLocation'],
    }
  );

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

interface SubmissionStatus {
  listingId: string;
  cropName: string;
  status: 'PENDING' | 'SUBMITTING' | 'SUCCESS' | 'FAILED';
  error?: string;
  orderId?: string;
}

function SectionCard({
  step,
  title,
  subtitle,
  icon,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-surface-200/80 bg-white/90 backdrop-blur-sm p-6 sm:p-7 shadow-soft ring-1 ring-black/[0.03]">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-50 to-cream-100 text-primary-700 ring-1 ring-primary-100">
          {icon}
        </div>
        <div className="min-w-0 pt-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600/90">
            Step {step}
          </p>
          <h2 className="text-lg font-semibold text-surface-900 tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-surface-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function OptionTile({
  id,
  name,
  value,
  checked,
  disabled,
  title,
  description,
  icon,
  register,
}: {
  id: string;
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  icon: React.ReactNode;
  register: ReturnType<typeof useForm<CheckoutFormValues>>['register'];
}) {
  return (
    <label
      htmlFor={id}
      className={`relative flex items-start gap-4 rounded-2xl border p-4 transition-all duration-200 ${
        disabled
          ? 'cursor-not-allowed border-surface-100 bg-surface-50/80 opacity-50'
          : checked
            ? 'cursor-pointer border-primary-300 bg-gradient-to-br from-primary-50/90 to-cream-50 shadow-sm ring-1 ring-primary-200/60'
            : 'cursor-pointer border-surface-200/80 bg-white hover:border-surface-300 hover:shadow-sm'
      }`}
    >
      <input
        id={id}
        type="radio"
        value={value}
        disabled={disabled}
        className="sr-only"
        {...register(name as keyof CheckoutFormValues)}
      />
      <div
        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          checked ? 'bg-primary-600 text-white shadow-sm' : 'bg-surface-100 text-surface-500'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold text-sm ${checked ? 'text-surface-900' : 'text-surface-800'}`}>
          {title}
        </p>
        <p className="text-xs text-surface-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div
        className={`mt-1 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center ${
          checked ? 'border-primary-600 bg-primary-600' : 'border-surface-300 bg-white'
        }`}
      >
        {checked && (
          <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
    </label>
  );
}

const CHECKOUT_STEPS = [
  { label: 'Cart', done: true },
  { label: 'Details', active: true },
  { label: 'Confirm', done: false },
] as const;

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { items, getTotal, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const [submissionStatuses, setSubmissionStatuses] = useState<SubmissionStatus[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutComplete, setCheckoutComplete] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
      deliveryMethod: 'PICKUP',
      paymentMethod: 'PAY_ON_PICKUP',
      deliveryLocation: '',
      notes: '',
    },
  });

  const deliveryMethod = watch('deliveryMethod');
  const paymentMethod = watch('paymentMethod');

  const onSubmit = async (data: CheckoutFormValues) => {
    if (items.length === 0) return;

    setIsCheckingOut(true);

    const statuses = items.map((item) => ({
      listingId: item.listingId,
      cropName: item.cropName,
      status: 'PENDING' as const,
    }));
    setSubmissionStatuses(statuses);

    const updateStatus = (listingId: string, updates: Partial<SubmissionStatus>) => {
      setSubmissionStatuses((prev) =>
        prev.map((s) => (s.listingId === listingId ? { ...s, ...updates } : s))
      );
    };

    let allSucceeded = true;

    for (const item of items) {
      updateStatus(item.listingId, { status: 'SUBMITTING' });

      try {
        const response = await ordersApi.createOrder({
          listingId: item.listingId,
          quantity: item.quantity,
          deliveryMethod: data.deliveryMethod,
          deliveryLocation: data.deliveryMethod === 'DELIVERY' ? data.deliveryLocation : undefined,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
          contactName: data.name,
          contactPhone: data.phone,
        });

        if (response.success && response.data?.order) {
          updateStatus(item.listingId, { status: 'SUCCESS', orderId: response.data.order._id });
        } else {
          allSucceeded = false;
          updateStatus(item.listingId, { status: 'FAILED', error: 'Failed to create order' });
        }
      } catch (err: unknown) {
        allSucceeded = false;
        const axiosError = err as {
          response?: { data?: { message?: string; error?: string } };
          message?: string;
        };
        const errorMsg =
          axiosError.response?.data?.message ||
          axiosError.response?.data?.error ||
          axiosError.message ||
          'Submission failed';
        updateStatus(item.listingId, { status: 'FAILED', error: errorMsg });
      }
    }

    if (allSucceeded) {
      clearCart();
    }

    setIsCheckingOut(false);
    setCheckoutComplete(true);
  };

  const formatPrice = (price: number) => `GH₵ ${price.toFixed(2)}`;
  const cartImageUrl = (url?: string) => resolveMediaUrl(url) ?? url;

  if (items.length === 0 && !checkoutComplete) {
    navigate('/cart');
    return null;
  }

  if (checkoutComplete) {
    const succeeded = submissionStatuses.filter((s) => s.status === 'SUCCESS');
    const failed = submissionStatuses.filter((s) => s.status === 'FAILED');
    const allSuccess = failed.length === 0;

    return (
      <div className="min-h-screen bg-gradient-to-b from-cream-50 via-surface-50 to-white">
        <MarketplaceNav backLink={{ to: '/marketplace', label: '← Marketplace' }} />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary-100/30 via-transparent to-emerald-100/40 blur-2xl -z-10" />
            <div className="rounded-3xl border border-surface-200/80 bg-white/95 p-8 sm:p-10 text-center shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.04]">
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
                  allSuccess
                    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-200'
                    : 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg shadow-amber-200'
                }`}
              >
                {allSuccess ? (
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>

              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-600/90 mb-2">
                Order confirmed
              </p>
              <h1 className="text-3xl font-semibold text-surface-900 tracking-tight mb-3">
                {allSuccess ? 'Thank you for your order' : 'Order partially placed'}
              </h1>
              <p className="text-surface-500 mb-8 leading-relaxed max-w-md mx-auto">
                {allSuccess
                  ? 'Your order has been sent to the field agent for the farmer. They will confirm and coordinate pickup or delivery.'
                  : `${succeeded.length} orders placed successfully, ${failed.length} could not be completed.`}
              </p>

              <div className="space-y-3 mb-8 text-left">
                {submissionStatuses.map((status) => (
                  <div
                    key={status.listingId}
                    className={`flex justify-between items-center gap-4 p-4 rounded-2xl border ${
                      status.status === 'SUCCESS'
                        ? 'border-emerald-200/80 bg-emerald-50/60'
                        : 'border-red-200/80 bg-red-50/60'
                    }`}
                  >
                    <span className="font-semibold capitalize text-surface-900">{status.cropName}</span>
                    {status.status === 'SUCCESS' ? (
                      <span className="text-emerald-700 text-sm font-medium tabular-nums">
                        #{status.orderId?.slice(-6).toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-red-600 text-sm text-right">{status.error}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Link to="/marketplace">
                  <Button variant="secondary" className="w-full sm:w-auto !rounded-xl">
                    Continue shopping
                  </Button>
                </Link>
                <Link to="/buyer/orders">
                  <Button variant="primary" className="w-full sm:w-auto !rounded-xl">
                    View my orders
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream-50 via-surface-50 to-white pb-16">
      <MarketplaceNav backLink={{ to: '/cart', label: '← Back to cart' }} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        {/* Header + progress */}
        <header className="mb-8 lg:mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-600/90 mb-2">
            Secure checkout
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-surface-900 tracking-tight">
            Complete your order
          </h1>
          <p className="text-surface-500 mt-2 max-w-xl">
            Fresh produce goes straight to the farmer&apos;s field agent — confirm your details below.
          </p>

          <ol className="mt-8 flex items-center gap-2 sm:gap-0 max-w-md">
            {CHECKOUT_STEPS.map((step, i) => (
              <li key={step.label} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      'active' in step && step.active
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'done' in step && step.done
                          ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                          : 'bg-surface-100 text-surface-400'
                    }`}
                  >
                    {'done' in step && step.done && !('active' in step) ? (
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={`text-sm font-medium hidden sm:inline ${
                      'active' in step && step.active ? 'text-surface-900' : 'text-surface-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < CHECKOUT_STEPS.length - 1 && (
                  <div className="hidden sm:block flex-1 h-px bg-surface-200 mx-3 min-w-[2rem]" />
                )}
              </li>
            ))}
          </ol>
        </header>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
          <div className="flex-1 w-full space-y-5">
            <form id="checkout-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <SectionCard
                step={1}
                title="Contact information"
                subtitle="How the farmer or agent can reach you"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Full name"
                    {...register('name')}
                    error={errors.name?.message}
                    disabled={isCheckingOut}
                  />
                  <Input
                    label="Phone number"
                    {...register('phone')}
                    error={errors.phone?.message}
                    disabled={isCheckingOut}
                  />
                </div>
              </SectionCard>

              <SectionCard
                step={2}
                title="Delivery method"
                subtitle="Choose how you'd like to receive your produce"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                }
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <OptionTile
                    id="delivery-pickup"
                    name="deliveryMethod"
                    value="PICKUP"
                    checked={deliveryMethod === 'PICKUP'}
                    disabled={isCheckingOut}
                    title="Pick up from farmer"
                    description="Collect directly at the farm or agreed meeting point"
                    register={register}
                    icon={
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    }
                  />
                  <OptionTile
                    id="delivery-home"
                    name="deliveryMethod"
                    value="DELIVERY"
                    checked={deliveryMethod === 'DELIVERY'}
                    disabled={isCheckingOut}
                    title="Arranged delivery"
                    description="The agent coordinates delivery to your location"
                    register={register}
                    icon={
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                      </svg>
                    }
                  />
                </div>

                {deliveryMethod === 'DELIVERY' && (
                  <div className="mt-4 animate-fade-in">
                    <Input
                      label="Delivery location"
                      placeholder="Enter your exact address or landmark"
                      {...register('deliveryLocation')}
                      error={errors.deliveryLocation?.message}
                      disabled={isCheckingOut}
                    />
                  </div>
                )}
              </SectionCard>

              <SectionCard
                step={3}
                title="Payment method"
                subtitle="Pay when you receive your order"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                }
              >
                <div className="space-y-3">
                  <OptionTile
                    id="pay-pickup"
                    name="paymentMethod"
                    value="PAY_ON_PICKUP"
                    checked={paymentMethod === 'PAY_ON_PICKUP'}
                    disabled={isCheckingOut || deliveryMethod === 'DELIVERY'}
                    title="Pay on pickup"
                    description="Pay the farmer or agent when you collect"
                    register={register}
                    icon={
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                    }
                  />
                  <OptionTile
                    id="pay-cod"
                    name="paymentMethod"
                    value="CASH_ON_DELIVERY"
                    checked={paymentMethod === 'CASH_ON_DELIVERY'}
                    disabled={isCheckingOut || deliveryMethod === 'PICKUP'}
                    title="Cash on delivery"
                    description="Pay in cash when your order arrives"
                    register={register}
                    icon={
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  />
                  <OptionTile
                    id="pay-momo"
                    name="paymentMethod"
                    value="SIMULATED_MOMO"
                    checked={paymentMethod === 'SIMULATED_MOMO'}
                    disabled={isCheckingOut}
                    title="Mobile Money"
                    description="Pay via MoMo — simulated for this demo"
                    register={register}
                    icon={
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    }
                  />
                </div>
              </SectionCard>

              <SectionCard
                step={4}
                title="Order notes"
                subtitle="Optional — special instructions for the farmer"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                }
              >
                <TextArea
                  placeholder="e.g. Please call before delivery, prefer early morning pickup..."
                  {...register('notes')}
                  disabled={isCheckingOut}
                  rows={3}
                />
              </SectionCard>
            </form>
          </div>

          {/* Order summary sidebar */}
          <aside className="w-full lg:w-[22rem] shrink-0 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-surface-200/80 bg-white/95 backdrop-blur-sm overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.04]">
              <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-5 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-100/90">
                  Order summary
                </p>
                <p className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">
                  {formatPrice(getTotal())}
                </p>
                <p className="text-sm text-primary-100/90 mt-0.5">
                  {items.length} {items.length === 1 ? 'item' : 'items'} · Direct from farmer
                </p>
              </div>

              <div className="p-5 space-y-4 max-h-[42vh] overflow-y-auto">
                {items.map((item) => (
                  <div key={item.listingId} className="flex gap-3">
                    <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-cream-100 ring-1 ring-black/[0.05] flex items-center justify-center">
                      {cartImageUrl(item.imageUrl) ? (
                        <img
                          src={cartImageUrl(item.imageUrl)!}
                          alt={item.cropName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xl">🌾</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-surface-900 capitalize text-sm truncate">
                        {item.cropName}
                      </p>
                      <p className="text-xs text-surface-500 mt-0.5">{item.community}</p>
                      <p className="text-xs text-surface-400 mt-1">
                        {item.quantity} × {formatPrice(item.priceSnapshot)}
                        <span className="lowercase">/{item.unit}</span>
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-surface-900 tabular-nums shrink-0">
                      {formatPrice(item.quantity * item.priceSnapshot)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-surface-100 px-5 py-4 space-y-2 bg-surface-50/50">
                <div className="flex justify-between text-sm text-surface-600">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatPrice(getTotal())}</span>
                </div>
                <div className="flex justify-between text-sm text-surface-600">
                  <span>Delivery fee</span>
                  <span className="text-surface-400">Included</span>
                </div>
                <div className="flex justify-between font-semibold text-surface-900 text-lg pt-2 border-t border-surface-200/80">
                  <span>Total</span>
                  <span className="tabular-nums text-primary-700">{formatPrice(getTotal())}</span>
                </div>
              </div>

              {isCheckingOut && submissionStatuses.length > 0 && (
                <div className="px-5 py-4 border-t border-surface-100 space-y-2 bg-white">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-surface-400">
                    Placing orders
                  </p>
                  {submissionStatuses.map((status) => (
                    <div key={status.listingId} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-surface-700">{status.cropName}</span>
                      {status.status === 'PENDING' && (
                        <span className="text-surface-400 text-xs">Waiting…</span>
                      )}
                      {status.status === 'SUBMITTING' && (
                        <span className="text-primary-600 flex items-center gap-1.5 text-xs font-medium">
                          <Spinner size="sm" /> Submitting
                        </span>
                      )}
                      {status.status === 'SUCCESS' && (
                        <span className="text-emerald-600 text-xs font-medium">Done</span>
                      )}
                      {status.status === 'FAILED' && (
                        <span className="text-red-600 text-xs font-medium">Failed</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="p-5 pt-0">
                <Button
                  type="submit"
                  form="checkout-form"
                  className="w-full !rounded-xl !py-3.5 !text-base !font-semibold shadow-sm hover:shadow-md transition-shadow"
                  size="lg"
                  loading={isCheckingOut}
                  disabled={isCheckingOut}
                >
                  Place order
                </Button>
                <p className="text-center text-xs text-surface-400 mt-3 leading-relaxed">
                  Your order is sent to the field agent for confirmation
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
