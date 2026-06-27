import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { Card } from '../../components/shared/Card';

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, getTotal, clearCart } = useCartStore();
  const { isAuthenticated, user } = useAuthStore();

  const handleCheckout = () => {
    if (!isAuthenticated() || user?.role !== 'BUYER') {
      // User must be logged in as a buyer to checkout
      navigate('/login?redirect=/checkout');
      return;
    }
    navigate('/checkout');
  };

  const formatPrice = (price: number) => `GH₵ ${price.toFixed(2)}`;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-surface-50">
        <nav className="bg-white border-b border-surface-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">A</span>
                </div>
                <span className="text-lg font-bold text-surface-900">AgroVoice</span>
              </Link>
              <Link to="/marketplace">
                <Button variant="ghost" size="sm">Back to Marketplace</Button>
              </Link>
            </div>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <EmptyState
            title="Your cart is empty"
            message="Looks like you haven't added any fresh produce to your cart yet."
            actionLabel="Browse Marketplace"
            onAction={() => navigate('/marketplace')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <nav className="bg-white border-b border-surface-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold">A</span>
              </div>
              <span className="text-lg font-bold text-surface-900">AgroVoice</span>
            </Link>
            <Link to="/marketplace">
              <Button variant="ghost" size="sm">Continue Shopping</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-surface-900 mb-6">Your Cart</h1>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Cart Items */}
          <div className="flex-1 space-y-4">
            {items.map((item) => (
              <Card key={item.listingId} className="flex flex-col sm:flex-row gap-4 !p-4">
                <div className="w-full sm:w-32 h-32 flex-shrink-0 bg-surface-100 rounded-lg overflow-hidden flex items-center justify-center">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.cropName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">🌾</span>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <Link to={`/products/${item.listingId}`}>
                        <h3 className="text-lg font-semibold text-surface-900 hover:text-primary-700 capitalize">
                          {item.cropName}
                        </h3>
                      </Link>
                      <button
                        onClick={() => removeItem(item.listingId)}
                        className="text-surface-400 hover:text-red-500 transition-colors"
                        aria-label="Remove item"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-sm text-surface-500 mt-1">
                      {item.community} • {formatPrice(item.priceSnapshot)} per {item.unit}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center border border-surface-300 rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateQuantity(item.listingId, item.quantity - 1)}
                        className="px-3 py-1 text-surface-600 hover:bg-surface-100 transition-colors"
                        disabled={item.quantity <= 1}
                      >
                        −
                      </button>
                      <span className="w-12 text-center border-x border-surface-300 py-1 text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.listingId, item.quantity + 1)}
                        className="px-3 py-1 text-surface-600 hover:bg-surface-100 transition-colors"
                        disabled={item.quantity >= item.maxQuantity}
                      >
                        +
                      </button>
                    </div>
                    <span className="font-bold text-surface-900">
                      {formatPrice(item.priceSnapshot * item.quantity)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearCart} className="text-surface-500">
                Clear Cart
              </Button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <Card className="sticky top-24 !p-6">
              <h2 className="text-lg font-bold text-surface-900 mb-4">Order Summary</h2>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-surface-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(getTotal())}</span>
                </div>
                <div className="flex justify-between text-surface-600">
                  <span>Delivery</span>
                  <span>Calculated at checkout</span>
                </div>
                <div className="border-t border-surface-200 pt-3 flex justify-between font-bold text-surface-900 text-lg">
                  <span>Total</span>
                  <span>{formatPrice(getTotal())}</span>
                </div>
              </div>

              <Button onClick={handleCheckout} className="w-full" size="lg">
                Proceed to Checkout
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
