'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { ArrowRight } from 'lucide-react';

interface Pipeline {
  applicantsPending: number;
  applicantsApproved: number;
  ordersAwaitingPayment: number;
  ordersPaid: number;
  ordersShipped: number;
  ordersDelivered: number;
}

export default function DropshipPipelineBar() {
  const { apiFetch } = useApi();
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);

  useEffect(() => {
    apiFetch('/api/admin/dropship/pipeline')
      .then((res) => setPipeline(res.data))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pipeline) return null;

  const stages: { label: string; value: number }[] = [
    { label: 'Applicants Pending', value: pipeline.applicantsPending },
    { label: 'Approved Sellers', value: pipeline.applicantsApproved },
    { label: 'Orders Awaiting Payment', value: pipeline.ordersAwaitingPayment },
    { label: 'Paid — In Fulfillment', value: pipeline.ordersPaid },
    { label: 'Shipped', value: pipeline.ordersShipped },
    { label: 'Delivered / Completed', value: pipeline.ordersDelivered },
  ];

  return (
    <div
      className="mb-6 rounded-2xl px-5 py-4 flex items-center gap-1 flex-wrap"
      style={{ border: '1px solid #ede9e1', background: '#fff' }}
    >
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1">
          <div className="flex flex-col items-center px-3 py-1 min-w-[92px]">
            <span className="text-lg font-bold" style={{ color: '#1a1714' }}>{s.value}</span>
            <span className="text-[10px] text-center leading-tight" style={{ color: '#9c9690' }}>{s.label}</span>
          </div>
          {i < stages.length - 1 && (
            <ArrowRight size={14} style={{ color: '#d8d3c9' }} className="flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}
