
'use client';

import { useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';

type Invoice = {
  company: string | null;
  issue_date: string | null;
  total_eur: number | null;
  consumption_kwh: number | null;
  energy_amount_eur: number | null;
  power_amount_eur: number | null;
};

type MonthlyData = {
  month: string;
  label: string;
  spend: number;
  kwh: number;
  energy: number;
  power: number;
};

type AnnualData = {
  year: string;
  spend: number;
  kwh: number;
  energy: number;
  averagePrice: number;
};

const euro = (value: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);

const number = (value: number) =>
  new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 2,
  }).format(value);

function Stats() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState('todos');
  const [selectedCompany, setSelectedCompany] = useState('todas');

  useEffect(() => {
    async function loadInvoices() {
      setLoading(true);
      setError('');

      const { data, error } = await createClient()
        .from('invoices')
        .select(
          'company,issue_date,total_eur,consumption_kwh,energy_amount_eur,power_amount_eur'
        )
        .order('issue_date', { ascending: true });

      if (error) {
        setError(error.message);
        setRows([]);
      } else {
        setRows((data || []) as Invoice[]);
      }

      setLoading(false);
    }

    loadInvoices();
  }, []);

  const years = useMemo(() => {
    return [...new Set(
      rows
        .filter((r) => r.issue_date)
        .map((r) => r.issue_date!.slice(0, 4))
    )].sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const companies = useMemo(() => {
    return [...new Set(
      rows.map((r) => r.company).filter((c): c is string => !!c)
    )].sort((a, b) => a.localeCompare(b, 'es'));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (!r.issue_date) return false;

      const yearMatches =
        selectedYear === 'todos' ||
        r.issue_date.slice(0, 4) === selectedYear;

      const companyMatches =
        selectedCompany === 'todas' ||
        r.company === selectedCompany;

      return yearMatches && companyMatches;
    });
  }, [rows, selectedYear, selectedCompany]);

  const data = useMemo(() => {
    const map = new Map<string, MonthlyData>();

    filteredRows.forEach((invoice) => {
      if (!invoice.issue_date) return;

      const key = invoice.issue_date.slice(0, 7);
      const date = new Date(`${key}-01T12:00:00`);

      const item = map.get(key) || {
        month: key,
        label: new Intl.DateTimeFormat('es-ES', {
          month: 'short',
          year: 'numeric',
        }).format(date),
        spend: 0,
        kwh: 0,
        energy: 0,
        power: 0,
      };

      item.spend += invoice.total_eur || 0;
      item.kwh += invoice.consumption_kwh || 0;
      item.energy += invoice.energy_amount_eur || 0;
      item.power += invoice.power_amount_eur || 0;

      map.set(key, item);
    });

    return [...map.values()].sort((a, b) =>
      a.month.localeCompare(b.month)
    );
  }, [filteredRows]);

  const annualData = useMemo(() => {
  const map = new Map<string, AnnualData>();

  rows.forEach((invoice) => {
    if (!invoice.issue_date) return;

    if (
      selectedCompany !== 'todas' &&
      invoice.company !== selectedCompany
    ) return;

    const year = invoice.issue_date.slice(0, 4);

    const item = map.get(year) || {
      year,
      spend: 0,
      kwh: 0,
      energy: 0,
      averagePrice: 0,
    };

    item.spend += invoice.total_eur || 0;
    item.kwh += invoice.consumption_kwh || 0;
    item.energy += invoice.energy_amount_eur || 0;

    item.averagePrice =
      item.kwh > 0 ? item.energy / item.kwh : 0;

    map.set(year, item);
  });

  return [...map.values()].sort((a, b) =>
    a.year.localeCompare(b.year)
  );
}, [rows, selectedCompany]);

const annualComparison = useMemo(() => {
  const byYear = new Map(
    annualData.map((item) => [item.year, item])
  );

  return annualData.map((item) => {
    const previousYear = String(Number(item.year) - 1);
    const previous = byYear.get(previousYear);

    const calculateChange = (
      current: number,
      previousValue: number
    ) => {
      if (previousValue <= 0) return null;

      return ((current - previousValue) / previousValue) * 100;
    };

    return {
      ...item,
      spendChange: previous
        ? calculateChange(item.spend, previous.spend)
        : null,
      kwhChange: previous
        ? calculateChange(item.kwh, previous.kwh)
        : null,
      priceChange: previous
        ? calculateChange(item.averagePrice, previous.averagePrice)
        : null,
    };
  });
}, [annualData]);
  const summary = useMemo(() => {
    const spend = filteredRows.reduce(
      (sum, r) => sum + (r.total_eur || 0), 0
    );

    const kwh = filteredRows.reduce(
      (sum, r) => sum + (r.consumption_kwh || 0), 0
    );

    const energy = filteredRows.reduce(
      (sum, r) => sum + (r.energy_amount_eur || 0), 0
    );

    const power = filteredRows.reduce(
      (sum, r) => sum + (r.power_amount_eur || 0), 0
    );

    return {
      spend,
      kwh,
      energy,
      power,
      averagePrice: kwh > 0 ? energy / kwh : 0,
      invoiceCount: filteredRows.length,
    };
  }, [filteredRows]);

  const comparison = useMemo(() => {
    if (data.length < 2) return null;

    const current = data[data.length - 1].spend;
    const previous = data[data.length - 2].spend;

    if (previous === 0) return null;

    return ((current - previous) / previous) * 100;
  }, [data]);

  if (loading) {
    return (
      <AuthGuard>
        <div className="panel p-8 text-center text-slate-500">
          Cargando estadísticas...
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Estadísticas</h1>
          <p className="text-slate-500 mt-1">
            Evolución de tus facturas de electricidad.
          </p>
        </div>

        {error && (
          <div className="panel p-4 text-red-600">
            Error al cargar las facturas: {error}
          </div>
        )}

        <div className="panel p-5">
          <h2 className="font-semibold mb-4">Filtros</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Año
              </label>
              <select
                className="field"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="todos">Todos los años</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Compañía eléctrica
              </label>
              <select
                className="field"
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
              >
                <option value="todas">Todas las compañías</option>
                {companies.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="panel p-8 text-center text-slate-500">
            No hay facturas para los filtros seleccionados.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="panel p-5">
                <p className="text-sm text-slate-500">Gasto total</p>
                <p className="text-2xl font-bold mt-2">
                  {euro(summary.spend)}
                </p>
              </div>

              <div className="panel p-5">
                <p className="text-sm text-slate-500">Consumo total</p>
                <p className="text-2xl font-bold mt-2">
                  {number(summary.kwh)} kWh
                </p>
              </div>

              <div className="panel p-5">
                <p className="text-sm text-slate-500">
                  Precio medio de energía
                </p>
                <p className="text-2xl font-bold mt-2">
                  {number(summary.averagePrice)} €/kWh
                </p>
              </div>

              <div className="panel p-5">
                <p className="text-sm text-slate-500">
                  Facturas analizadas
                </p>
                <p className="text-2xl font-bold mt-2">
                  {summary.invoiceCount}
                </p>
              </div>
            </div>

            {comparison !== null && (
              <div className="panel p-5">
                <h2 className="font-semibold mb-2">
                  Comparación con el mes anterior
                </h2>
                <p className="text-lg">
                  El gasto del último mes registrado ha{' '}
                  <strong>
                    {comparison > 0
                      ? 'aumentado'
                      : comparison < 0
                        ? 'disminuido'
                        : 'permanecido igual'}
                  </strong>{' '}
                  un {number(Math.abs(comparison))}%.
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Comparación entre los dos últimos meses con facturas.
                </p>
              </div>
            )}

<div className="space-y-6">
  <div>
    <h2 className="text-xl font-bold mb-1">
      Comparativa anual
    </h2>
    <p className="text-sm text-slate-500">
      Comparación del gasto y consumo de cada ejercicio.
    </p>
  </div>

  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div className="panel p-5">
      <p className="text-sm text-slate-500">Gasto anual</p>
      <p className="text-xl font-bold mt-2">
        {euro(annualData.reduce((sum, item) => sum + item.spend, 0))}
      </p>
    </div>

    <div className="panel p-5">
      <p className="text-sm text-slate-500">Consumo anual</p>
      <p className="text-xl font-bold mt-2">
        {number(annualData.reduce((sum, item) => sum + item.kwh, 0))} kWh
      </p>
    </div>

    <div className="panel p-5">
      <p className="text-sm text-slate-500">Precio medio de energía</p>
      <p className="text-xl font-bold mt-2">
        {number(
          annualData.reduce((sum, item) => sum + item.energy, 0) /
          Math.max(1, annualData.reduce((sum, item) => sum + item.kwh, 0))
        )} €/kWh
      </p>
    </div>
  </div>

  <div className="panel p-5">
    <h3 className="font-semibold mb-4">Gasto por año (€)</h3>
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={annualData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" />
          <YAxis />
          <Tooltip formatter={(value) => euro(Number(value))} />
          <Bar
            dataKey="spend"
            name="Gasto anual"
            fill="#2563eb"
            radius={[5, 5, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
<div className="panel p-5">
  <h3 className="font-semibold mb-4">
    Tabla comparativa anual
  </h3>

  <div className="overflow-x-auto">
    <table className="w-full text-sm text-left">
      <thead>
        <tr className="border-b text-slate-500">
          <th className="py-3 pr-4">Año</th>
          <th className="py-3 px-4">Gasto</th>
          <th className="py-3 px-4">Variación gasto</th>
          <th className="py-3 px-4">Consumo</th>
          <th className="py-3 px-4">Variación consumo</th>
          <th className="py-3 px-4">Precio medio</th>
          <th className="py-3 pl-4">Variación precio</th>
        </tr>
      </thead>

      <tbody>
        {annualComparison.map((item) => {
          const formatChange = (value: number | null) => {
            if (value === null) return 'Sin datos';

            return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
          };

          return (
            <tr key={item.year} className="border-b last:border-0">
              <td className="py-3 pr-4 font-semibold">
                {item.year}
              </td>

              <td className="py-3 px-4">
                {euro(item.spend)}
              </td>

              <td className="py-3 px-4">
                {formatChange(item.spendChange)}
              </td>

              <td className="py-3 px-4">
                {number(item.kwh)} kWh
              </td>

              <td className="py-3 px-4">
                {formatChange(item.kwhChange)}
              </td>

              <td className="py-3 px-4">
                {number(item.averagePrice)} €/kWh
              </td>

              <td className="py-3 pl-4">
                {formatChange(item.priceChange)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
</div>
  <div className="panel p-5">
    <h3 className="font-semibold mb-4">Consumo por año (kWh)</h3>
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={annualData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" />
          <YAxis />
          <Tooltip formatter={(value) => `${number(Number(value))} kWh`} />
          <Bar
            dataKey="kwh"
            name="Consumo anual"
            fill="#0f9f8f"
            radius={[5, 5, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
</div>

            <div className="panel p-5">
              <h2 className="font-semibold mb-4">Gasto mensual (€)</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => euro(Number(value))}
                    />
                    <Bar
                      dataKey="spend"
                      name="Gasto"
                      fill="#2563eb"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel p-5">
              <h2 className="font-semibold mb-4">
                Consumo mensual (kWh)
              </h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => `${number(Number(value))} kWh`}
                    />
                    <Line
                      type="monotone"
                      dataKey="kwh"
                      name="Consumo"
                      stroke="#0f9f8f"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel p-5">
              <h2 className="font-semibold mb-4">
                Coste de energía y potencia (€)
              </h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => euro(Number(value))}
                    />
                    <Bar
                      dataKey="energy"
                      name="Energía"
                      stackId="a"
                      fill="#2563eb"
                    />
                    <Bar
                      dataKey="power"
                      name="Potencia"
                      stackId="a"
                      fill="#93c5fd"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </AuthGuard>
  );
}

export default function Page() {
  return <Stats />;
}
