'use client';

import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';

const COMPARISON_FEATURES = [
  { key: 'customers', free: true, pro: true },
  { key: 'services', free: true, pro: true },
  { key: 'products', free: true, pro: true },
  { key: 'inventory', free: true, pro: true },
  { key: 'sales', free: true, pro: true },
  { key: 'payments', free: true, pro: true },
  { key: 'expenses', free: true, pro: true },
  { key: 'reports', free: true, pro: true },
  { key: 'publicPage', free: true, pro: true },
  { key: 'employees', free: '1', pro: 'unlimited' },
  { key: 'bookings', free: false, pro: true },
  { key: 'multiWarehouse', free: false, pro: false },
  { key: 'api', free: false, pro: false },
];

export default function PricingComparison() {
  const t = useTranslations('marketing.pricing.comparison');
  const tFeatures = useTranslations('marketing.features');

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
        {t('title')}
      </h2>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  {t('feature')}
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                  {t('free')}
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 bg-blue-50">
                  {t('pro')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {COMPARISON_FEATURES.map((feature, index) => (
                <tr key={feature.key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {tFeatures(`${feature.key}.title`)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {renderCell(feature.free)}
                  </td>
                  <td className="px-6 py-4 text-center bg-blue-50/50">
                    {renderCell(feature.pro)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function renderCell(value: boolean | string) {
  if (value === true) {
    return <Check className="w-5 h-5 text-green-600 mx-auto" />;
  }
  if (value === false) {
    return <X className="w-5 h-5 text-gray-300 mx-auto" />;
  }
  return <span className="text-sm text-gray-700">{value}</span>;
}
