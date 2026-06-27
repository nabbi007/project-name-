import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Order } from '../../api/orders.api';
import { Badge, Button } from '../shared';
import { getCropGradient } from '../../utils/listingDisplay';
import {
  AGENT_NEXT_STATUSES,
  formatOrderDate,
  formatOrderPrice,
  getOrderBuyerName,
  getOrderFarmerName,
  getOrderListingImage,
  getOrderListingName,
  getOrderStatusMeta,
  orderDisplayId,
} from '../../utils/orderDisplay';

interface AgentOrderCardProps {
  order: Order;
  onConfirmFarmer: (orderId: string) => void;
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
  actionPending?: boolean;
}

export const AgentOrderCard: React.FC<AgentOrderCardProps> = ({
  order,
  onConfirmFarmer,
  onUpdateStatus,
  actionPending = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const imageUrl = getOrderListingImage(order);
  const crop = getOrderListingName(order);
  const gradient = getCropGradient(crop);
  const status = getOrderStatusMeta(order.status);
  const nextStatuses = AGENT_NEXT_STATUSES[order.status] ?? [];
  const unit = typeof order.listing === 'object' ? order.listing.unit : '';

  return (
    <article className="card overflow-hidden hover:border-surface-300 transition-colors">
      <button
        type="button"
        className="w-full text-left p-4 sm:p-5 flex gap-4 items-start"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border border-surface-100 shadow-sm">
          {imageUrl ? (
            <img src={imageUrl} alt={crop} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <span className="text-2xl">🌾</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-xs text-surface-500">{orderDisplayId(order)}</span>
            <Badge color={status.color}>{status.label}</Badge>
          </div>
          <h3 className="font-semibold text-surface-900 capitalize truncate">{crop}</h3>
          <p className="text-sm text-surface-500 mt-0.5 truncate">
            {getOrderFarmerName(order)} · Buyer: {getOrderBuyerName(order)}
          </p>
          <p className="text-xs text-surface-400 mt-1">{formatOrderDate(order.createdAt)}</p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-surface-900">{formatOrderPrice(order.totalPrice)}</p>
          <p className="text-xs text-surface-500 mt-1">
            {order.quantity} {unit?.toLowerCase() || 'units'}
          </p>
          <span className="inline-block mt-2 text-surface-400 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 sm:px-5 pb-5 pt-0 border-t border-surface-100 space-y-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-4">
            <div>
              <dt className="text-surface-500">Delivery</dt>
              <dd className="font-medium capitalize">{order.deliveryMethod?.toLowerCase()}</dd>
            </div>
            <div>
              <dt className="text-surface-500">Payment</dt>
              <dd className="font-medium capitalize">{order.paymentMethod?.replace(/_/g, ' ').toLowerCase()}</dd>
            </div>
            {order.deliveryLocation && (
              <div className="sm:col-span-2">
                <dt className="text-surface-500">Location</dt>
                <dd className="font-medium">{order.deliveryLocation}</dd>
              </div>
            )}
            {order.notes && (
              <div className="sm:col-span-2">
                <dt className="text-surface-500">Buyer notes</dt>
                <dd className="font-medium">{order.notes}</dd>
              </div>
            )}
          </dl>

          {order.statusHistory.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-surface-700 mb-2">Status history</h4>
              <ol className="space-y-2">
                {order.statusHistory.map((entry, i) => (
                  <li key={`${entry.at}-${i}`} className="flex gap-2 text-sm">
                    <span className="text-surface-400 shrink-0">{formatOrderDate(entry.at)}</span>
                    <span className="font-medium">{entry.status.replace(/_/g, ' ')}</span>
                    {entry.note && <span className="text-surface-500">— {entry.note}</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {order.status === 'PENDING' && (
              <Button
                size="sm"
                loading={actionPending}
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmFarmer(order._id);
                }}
              >
                Confirm with farmer
              </Button>
            )}
            {nextStatuses
              .filter((s) => !(order.status === 'PENDING' && s === 'CONFIRMED'))
              .map((next) => (
                <Button
                  key={next}
                  size="sm"
                  variant={next === 'CANCELLED' ? 'secondary' : 'primary'}
                  loading={actionPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(order._id, next);
                  }}
                >
                  Mark {next.replace(/_/g, ' ').toLowerCase()}
                </Button>
              ))}
            {typeof order.farmer === 'object' && order.farmer._id && (
              <Link
                to={`/agent/farmers/${order.farmer._id}`}
                className="inline-flex items-center text-sm font-medium text-primary-600 hover:underline px-2"
              >
                View farmer →
              </Link>
            )}
          </div>
        </div>
      )}
    </article>
  );
};

export default AgentOrderCard;
