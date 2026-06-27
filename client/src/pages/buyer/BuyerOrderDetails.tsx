import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../api/orders.api';
import { complaintsApi } from '../../api/complaints.api';
import { Card } from '../../components/shared/Card';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { Spinner } from '../../components/shared/Spinner';
import { ErrorAlert } from '../../components/shared/Alerts';
import { ConfirmationDialog } from '../../components/shared/ConfirmationDialog';
import { Modal } from '../../components/shared/Modal';
import { TextArea } from '../../components/shared/TextArea';
import { useToast } from '../../components/shared/Toast';

const getStatusColor = (status: string): "green" | "yellow" | "red" | "blue" | "gray" | "purple" => {
  switch (status) {
    case 'PLACED': return 'blue';
    case 'CONFIRMED': return 'purple';
    case 'AWAITING_COLLECTION': return 'yellow';
    case 'COLLECTED': return 'green';
    case 'CANCELLED': return 'gray';
    case 'REJECTED': return 'red';
    default: return 'gray';
  }
};

const BuyerOrderDetails: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [complaintMessage, setComplaintMessage] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.getOrder(orderId!),
    enabled: !!orderId,
  });

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancelOrder(orderId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      addToast('Order cancelled successfully', 'success');
      setCancelDialogOpen(false);
    },
    onError: () => {
      addToast('Failed to cancel order', 'error');
    }
  });

  const complaintMutation = useMutation({
    mutationFn: (msg: string) => complaintsApi.createComplaint({ orderId: orderId!, message: msg }),
    onSuccess: () => {
      addToast('Problem reported successfully. Support will investigate.', 'success');
      setComplaintModalOpen(false);
      setComplaintMessage('');
    },
    onError: () => {
      addToast('Failed to report problem', 'error');
    }
  });

  const order = data?.data?.order;

  if (isLoading) {
    return <div className="py-12 flex justify-center"><Spinner size="lg" /></div>;
  }

  if (isError || !order) {
    return (
      <div className="py-12">
        <ErrorAlert>Failed to load order details.</ErrorAlert>
        <div className="mt-4">
          <Link to="/buyer/orders">
            <Button variant="secondary">Back to My Orders</Button>
          </Link>
        </div>
      </div>
    );
  }

  const listingName = typeof order.listing === 'object' ? order.listing.crop : 'Produce';
  const unit = typeof order.listing === 'object' ? order.listing.unit : 'units';
  const imageUrl = typeof order.listing === 'object' ? order.listing.imageUrl : null;
  const farmerName = typeof order.farmer === 'object' ? order.farmer.fullName : 'Farmer';

  const formatPrice = (price: number) => `GH₵ ${price.toFixed(2)}`;

  const handleCancel = () => {
    cancelMutation.mutate();
  };

  const handleReportProblem = () => {
    if (!complaintMessage.trim()) return;
    complaintMutation.mutate(complaintMessage);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/buyer/orders')} className="!px-2">
          ← Back
        </Button>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">
            Order #{order._id.slice(-6).toUpperCase()}
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Placed on {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Badge color={getStatusColor(order.status)}>
          {order.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Order details & Items */}
        <div className="md:col-span-2 space-y-6">
          <Card className="!p-6">
            <h2 className="text-lg font-bold text-surface-900 mb-4">Produce Details</h2>
            <div className="flex gap-4 items-center">
              <div className="w-20 h-20 bg-surface-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                {imageUrl ? (
                  <img src={imageUrl} alt={listingName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">🌾</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-surface-900 capitalize">{listingName}</h3>
                <p className="text-sm text-surface-500">Sold by {farmerName}</p>
                <div className="mt-2 flex justify-between items-center text-sm font-medium">
                  <span className="text-surface-700">{order.quantity} x {formatPrice(order.unitPriceAtOrder)}/{unit}</span>
                  <span className="text-surface-900">{formatPrice(order.totalPrice)}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="!p-6">
            <h2 className="text-lg font-bold text-surface-900 mb-4">Order Timeline</h2>
            <div className="space-y-4">
              {order.statusHistory.map((history, idx) => (
                <div key={idx} className="flex gap-4 relative">
                  {/* Timeline connecting line */}
                  {idx !== order.statusHistory.length - 1 && (
                    <div className="absolute top-8 left-[11px] bottom-[-16px] w-[2px] bg-surface-200"></div>
                  )}
                  <div className="w-6 h-6 rounded-full bg-primary-100 border-2 border-primary-500 flex-shrink-0 mt-1 z-10"></div>
                  <div>
                    <h4 className="font-semibold text-surface-900 capitalize">
                      {history.status.replace(/_/g, ' ').toLowerCase()}
                    </h4>
                    <p className="text-xs text-surface-500">
                      {new Date(history.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    {history.note && (
                      <p className="text-sm text-surface-600 mt-1 bg-surface-50 p-2 rounded">{history.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {order.notes && (
            <Card className="!p-6 bg-surface-50">
              <h2 className="text-sm font-bold text-surface-900 mb-2">Order Notes</h2>
              <p className="text-sm text-surface-700">{order.notes}</p>
            </Card>
          )}
        </div>

        {/* Right Column: Summary & Actions */}
        <div className="space-y-6">
          <Card className="!p-6">
            <h2 className="text-lg font-bold text-surface-900 mb-4">Summary</h2>
            
            <div className="space-y-4 text-sm">
              <div>
                <span className="text-surface-500 block mb-1">Delivery Method</span>
                <span className="font-medium text-surface-900">
                  {order.deliveryMethod === 'PICKUP' ? 'Pick up from farmer' : 'Delivery'}
                </span>
                {order.deliveryMethod === 'DELIVERY' && order.deliveryLocation && (
                  <p className="text-surface-600 mt-1 bg-surface-50 p-2 rounded">{order.deliveryLocation}</p>
                )}
              </div>

              <div>
                <span className="text-surface-500 block mb-1">Payment Method</span>
                <span className="font-medium text-surface-900 block">
                  {order.paymentMethod.replace(/_/g, ' ')}
                </span>
                <Badge color={order.status === 'COLLECTED' ? 'green' : 'yellow'} className="mt-1">
                  {order.status === 'COLLECTED' ? 'Paid' : 'Pending Payment'}
                </Badge>
              </div>

              <div className="border-t border-surface-200 pt-4 mt-4">
                <div className="flex justify-between items-center font-bold text-lg">
                  <span className="text-surface-900">Total</span>
                  <span className="text-primary-700">{formatPrice(order.totalPrice)}</span>
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {order.status === 'PLACED' && (
              <Button 
                variant="danger" 
                className="w-full" 
                onClick={() => setCancelDialogOpen(true)}
              >
                Cancel Order
              </Button>
            )}
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={() => setComplaintModalOpen(true)}
            >
              Report a Problem
            </Button>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Order"
        message="Are you sure you want to cancel this order? This action cannot be undone."
        confirmLabel="Yes, Cancel Order"
        cancelLabel="No, Keep It"
        loading={cancelMutation.isPending}
      />

      <Modal
        isOpen={complaintModalOpen}
        onClose={() => setComplaintModalOpen(false)}
        title="Report a Problem"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-600">
            Describe the issue you're having with this order. Our support team will investigate and contact you.
          </p>
          <TextArea
            placeholder="E.g. The quantity was incorrect, or the quality was poor..."
            rows={4}
            value={complaintMessage}
            onChange={(e) => setComplaintMessage(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-surface-200">
            <Button variant="ghost" onClick={() => setComplaintModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleReportProblem} 
              disabled={!complaintMessage.trim() || complaintMutation.isPending}
              loading={complaintMutation.isPending}
            >
              Submit Report
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BuyerOrderDetails;
