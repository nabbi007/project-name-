import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { ordersApi } from '../../api/orders.api';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import { TextArea } from '../../components/shared/TextArea';
import { Card } from '../../components/shared/Card';
import { Spinner } from '../../components/shared/Spinner';

const checkoutSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  deliveryMethod: z.enum(['PICKUP', 'DELIVERY']),
  deliveryLocation: z.string().optional(),
  paymentMethod: z.enum(['CASH_ON_DELIVERY', 'PAY_ON_PICKUP', 'SIMULATED_MOMO']),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.deliveryMethod === 'DELIVERY' && (!data.deliveryLocation || data.deliveryLocation.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'Delivery location is required for DELIVERY',
  path: ['deliveryLocation'],
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

interface SubmissionStatus {
  listingId: string;
  cropName: string;
  status: 'PENDING' | 'SUBMITTING' | 'SUCCESS' | 'FAILED';
  error?: string;
  orderId?: string;
}

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

  const onSubmit = async (data: CheckoutFormValues) => {
    if (items.length === 0) return;
    
    setIsCheckingOut(true);
    
    // Initialize status for all items
    const statuses = items.map(item => ({
      listingId: item.listingId,
      cropName: item.cropName,
      status: 'PENDING' as const,
    }));
    setSubmissionStatuses(statuses);

    const updateStatus = (listingId: string, updates: Partial<SubmissionStatus>) => {
      setSubmissionStatuses(prev => prev.map(s => 
        s.listingId === listingId ? { ...s, ...updates } : s
      ));
    };

    let allSucceeded = true;

    // Backend only supports 1 listing per order, so we submit sequentially
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
        });

        if (response.success && response.data?.order) {
          updateStatus(item.listingId, { status: 'SUCCESS', orderId: response.data.order._id });
        } else {
          allSucceeded = false;
          updateStatus(item.listingId, { status: 'FAILED', error: 'Failed to create order' });
        }
      } catch (err: any) {
        allSucceeded = false;
        const errorMsg = err.response?.data?.error || err.message || 'Submission failed';
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

  if (items.length === 0 && !checkoutComplete) {
    navigate('/cart');
    return null;
  }

  // Success / Partial Success Screen
  if (checkoutComplete) {
    const succeeded = submissionStatuses.filter(s => s.status === 'SUCCESS');
    const failed = submissionStatuses.filter(s => s.status === 'FAILED');

    return (
      <div className="min-h-screen bg-surface-50 py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <Card className="!p-8 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h1 className="text-3xl font-bold text-surface-900 mb-2">Checkout Complete</h1>
            <p className="text-surface-500 mb-8">
              {failed.length === 0 
                ? 'All your orders were placed successfully!' 
                : `${succeeded.length} orders placed, ${failed.length} failed.`}
            </p>

            <div className="space-y-3 mb-8 text-left">
              {submissionStatuses.map((status) => (
                <div key={status.listingId} className={`p-4 rounded-lg border ${status.status === 'SUCCESS' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold capitalize text-surface-900">{status.cropName}</span>
                    {status.status === 'SUCCESS' ? (
                      <span className="text-green-700 font-medium">Order #{status.orderId?.slice(-6).toUpperCase()}</span>
                    ) : (
                      <span className="text-red-600 text-sm">{status.error}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-4">
              <Link to="/marketplace">
                <Button variant="secondary">Back to Marketplace</Button>
              </Link>
              <Link to="/buyer/orders">
                <Button variant="primary">View My Orders</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 pb-16">
      <nav className="bg-white border-b border-surface-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-lg font-bold text-surface-900">AgroVoice Checkout</span>
            </Link>
            <Link to="/cart">
              <Button variant="ghost" size="sm">Back to Cart</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Checkout Form */}
          <div className="flex-1">
            <form id="checkout-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              <Card className="!p-6">
                <h2 className="text-lg font-bold text-surface-900 mb-4">Contact Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    {...register('name')}
                    error={errors.name?.message}
                    disabled={isCheckingOut}
                  />
                  <Input
                    label="Phone Number"
                    {...register('phone')}
                    error={errors.phone?.message}
                    disabled={isCheckingOut}
                  />
                </div>
              </Card>

              <Card className="!p-6">
                <h2 className="text-lg font-bold text-surface-900 mb-4">Delivery Method</h2>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        value="PICKUP" 
                        {...register('deliveryMethod')} 
                        disabled={isCheckingOut}
                        className="text-primary-600 focus:ring-primary-500"
                      />
                      <span>Pick up from farmer</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        value="DELIVERY" 
                        {...register('deliveryMethod')} 
                        disabled={isCheckingOut}
                        className="text-primary-600 focus:ring-primary-500"
                      />
                      <span>Delivery (arranged with farmer)</span>
                    </label>
                  </div>

                  {deliveryMethod === 'DELIVERY' && (
                    <div className="mt-4 animate-fade-in">
                      <Input
                        label="Delivery Location"
                        placeholder="Enter your exact location/address"
                        {...register('deliveryLocation')}
                        error={errors.deliveryLocation?.message}
                        disabled={isCheckingOut}
                      />
                    </div>
                  )}
                </div>
              </Card>

              <Card className="!p-6">
                <h2 className="text-lg font-bold text-surface-900 mb-2">Payment Method</h2>
                
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-3 text-sm mb-4">
                  <strong>Note:</strong> This is a hackathon prototype. Mobile Money payment is simulated and no real transaction will occur.
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      value="PAY_ON_PICKUP" 
                      {...register('paymentMethod')} 
                      disabled={isCheckingOut || deliveryMethod === 'DELIVERY'}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className={deliveryMethod === 'DELIVERY' ? 'text-surface-400' : ''}>
                      Pay on Pickup
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      value="CASH_ON_DELIVERY" 
                      {...register('paymentMethod')} 
                      disabled={isCheckingOut || deliveryMethod === 'PICKUP'}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className={deliveryMethod === 'PICKUP' ? 'text-surface-400' : ''}>
                      Cash on Delivery
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      value="SIMULATED_MOMO" 
                      {...register('paymentMethod')} 
                      disabled={isCheckingOut}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span>Mobile Money (Simulated)</span>
                  </label>
                </div>
              </Card>

              <Card className="!p-6">
                <h2 className="text-lg font-bold text-surface-900 mb-4">Order Notes (Optional)</h2>
                <TextArea
                  placeholder="Any special instructions for the farmer..."
                  {...register('notes')}
                  disabled={isCheckingOut}
                  rows={3}
                />
              </Card>

            </form>
          </div>

          {/* Order Summary Sidebar */}
          <div className="w-full lg:w-96 flex-shrink-0 space-y-6">
            <Card className="sticky top-24 !p-6">
              <h2 className="text-lg font-bold text-surface-900 mb-4">Items ({items.length})</h2>
              
              <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto pr-2 scrollbar-thin">
                {items.map(item => (
                  <div key={item.listingId} className="flex justify-between items-start border-b border-surface-100 pb-3 last:border-0 last:pb-0">
                    <div>
                      <h4 className="font-semibold text-surface-900 capitalize text-sm">{item.cropName}</h4>
                      <p className="text-xs text-surface-500">{item.quantity} x {formatPrice(item.priceSnapshot)}/{item.unit}</p>
                    </div>
                    <span className="font-medium text-surface-900 text-sm">
                      {formatPrice(item.quantity * item.priceSnapshot)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-surface-200 pt-4 mb-6">
                <div className="flex justify-between font-bold text-surface-900 text-xl">
                  <span>Total</span>
                  <span>{formatPrice(getTotal())}</span>
                </div>
              </div>

              {isCheckingOut && submissionStatuses.length > 0 && (
                <div className="mb-6 space-y-2">
                  <h4 className="text-xs font-semibold text-surface-500 uppercase">Submission Status</h4>
                  {submissionStatuses.map(status => (
                    <div key={status.listingId} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{status.cropName}</span>
                      {status.status === 'PENDING' && <span className="text-surface-400">Waiting...</span>}
                      {status.status === 'SUBMITTING' && <span className="text-primary-600 flex items-center gap-1"><Spinner size="sm" /> Submitting...</span>}
                      {status.status === 'SUCCESS' && <span className="text-green-600">Success</span>}
                      {status.status === 'FAILED' && <span className="text-red-600">Failed</span>}
                    </div>
                  ))}
                </div>
              )}

              <Button 
                type="submit" 
                form="checkout-form" 
                className="w-full" 
                size="lg"
                loading={isCheckingOut}
                disabled={isCheckingOut}
              >
                Place Order
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
