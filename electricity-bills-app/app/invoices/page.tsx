'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FileUp,
  Trash2,
  Download,
  LoaderCircle,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';
import { createClient } from '@/lib/supabase/client';
import type { BillExtraction } from '@/lib/types';

const bucket = 'electricity-bills';

type Saved = {
  id: string;
  company: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  period_start: string | null;
  period_end: string | null;
  consumption_kwh: number | null;
  total_eur: number | null;
  storage_path: string;
};

function Invoices() {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [extracted, setExtracted] = useState<BillExtraction | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);

  async function load() {
    const s = createClient();

    const { data, error } = await s
      .from('invoices')
      .select('*')
      .order('issue_date', { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    setSaved((data || []) as Saved[]);
  }

  useEffect(() => {
    load();
  }, []);

  // Diagnóstico: comprueba cuándo React actualiza los datos extraídos.
  useEffect(() => {
    if (extracted) {
      console.log('ESTADO REACT ACTUALIZADO:', extracted);
    }
  }, [extracted]);

  function addFiles(list: FileList | null) {
    if (!list) return;

    const valid = Array.from(list).filter(
      f => f.type === 'application/pdf' && f.size <= 20 * 1024 * 1024
    );

    setFiles(old => [...old, ...valid]);

    if (valid.length !== list.length) {
      setError('Solo se admiten PDF de hasta 20 MB.');
    }
  }

  async function analyzeNext() {
    if (!files.length) return;

    const file = files[0];

    setCurrentFile(file);
    setBusy(true);
    setError('');
    setStatus(`Analizando ${file.name} con Gemini…`);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const r = await fetch('/api/extract', {
        method: 'POST',
        body: fd
      });

      const j = await r.json();

      if (!r.ok) {
        throw new Error(j.error || 'Error al analizar');
      }

      // La API devuelve los datos dentro de j.data.
      const extractedData = j.data?.data ?? j.data;

      if (!extractedData || typeof extractedData !== 'object') {
        throw new Error('Gemini no ha devuelto datos de factura válidos.');
      }

      console.log('DATOS RECIBIDOS DE GEMINI:', extractedData);

      setExtracted(extractedData as BillExtraction);

      setStatus('Revisa los datos extraídos antes de guardar.');

    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo analizar el PDF.'
      );
    } finally {
      setBusy(false);
    }
  }

  function update<K extends keyof BillExtraction>(
    key: K,
    value: BillExtraction[K]
  ) {
    setExtracted(old => old ? { ...old, [key]: value } : old);
  }

  async function save() {
    if (!extracted || !currentFile) return;

    setBusy(true);
    setError('');

    const s = createClient();

    try {
      const { data: { user } } = await s.auth.getUser();

      if (!user) throw new Error('Sesión caducada.');

      const safeName = currentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;

      const upload = await s.storage.from(bucket).upload(path, currentFile, {
        contentType: 'application/pdf',
        upsert: false
      });

      if (upload.error) throw upload.error;

      const d = extracted;

      const record = {
        user_id: user.id,
        company: d.company,
        invoice_number: d.invoice_number,
        issue_date: d.issue_date,
        period_start: d.period_start,
        period_end: d.period_end,
        billing_days: d.billing_days,
        total_eur: d.total_eur,
        consumption_kwh: d.consumption_kwh,
        average_energy_price_eur_kwh: d.average_energy_price_eur_kwh,
        contracted_power_p1_kw: d.contracted_power_p1_kw,
        contracted_power_p2_kw: d.contracted_power_p2_kw,
        power_amount_eur: d.power_amount_eur,
        energy_amount_eur: d.energy_amount_eur,
        electricity_tax_eur: d.electricity_tax_eur,
        meter_rental_eur: d.meter_rental_eur,
        vat_rate_percent: d.vat_rate_percent,
        vat_amount_eur: d.vat_amount_eur,
        other_charges_eur: d.other_charges_eur,
        cups: d.cups,
        supply_address: d.supply_address,
        contract_number: d.contract_number,
        distributor: d.distributor,
        max_demand_p1_kw: d.max_demand_p1_kw,
        max_demand_p2_kw: d.max_demand_p2_kw,
        periods: d.periods,
        other_concepts: d.other_concepts,
        confidence: d.confidence,
        review_notes: d.review_notes,
        storage_path: path,
        original_filename: currentFile.name
      };

      const ins = await s.from('invoices').insert(record);

      if (ins.error) {
        await s.storage.from(bucket).remove([path]);
        throw ins.error;
      }

      setExtracted(null);
      setCurrentFile(null);
      setFiles(old => old.slice(1));
      setStatus('Factura guardada correctamente.');

      await load();

    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo guardar la factura.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(b: Saved) {
    if (
      !confirm(
        `¿Eliminar la factura ${b.invoice_number || b.issue_date || ''}? Esta acción no se puede deshacer.`
      )
    ) return;

    const s = createClient();

    await s.storage.from(bucket).remove([b.storage_path]);

    const { error } = await s
      .from('invoices')
      .delete()
      .eq('id', b.id);

    if (error) setError(error.message);
    else load();
  }

  async function download(b: Saved) {
    const s = createClient();

    const { data, error } = await s.storage
      .from(bucket)
      .createSignedUrl(b.storage_path, 60);

    if (error) setError(error.message);
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  const fields: [keyof BillExtraction, string][] = [
    ['company', 'Compañía'],
    ['invoice_number', 'Número de factura'],
    ['issue_date', 'Fecha emisión'],
    ['period_start', 'Inicio periodo'],
    ['period_end', 'Fin periodo'],
    ['billing_days', 'Días facturados'],
    ['total_eur', 'Total (€)'],
    ['consumption_kwh', 'Consumo (kWh)'],
    ['average_energy_price_eur_kwh', 'Precio medio energía (€/kWh)'],
    ['contracted_power_p1_kw', 'Potencia P1 (kW)'],
    ['contracted_power_p2_kw', 'Potencia P2 (kW)'],
    ['power_amount_eur', 'Importe potencia (€)'],
    ['energy_amount_eur', 'Importe energía (€)'],
    ['electricity_tax_eur', 'Impuesto electricidad (€)'],
    ['meter_rental_eur', 'Alquiler contador (€)'],
    ['vat_rate_percent', 'IVA (%)'],
    ['vat_amount_eur', 'IVA importe (€)'],
    ['other_charges_eur', 'Otros cargos (€)'],
    ['cups', 'CUPS'],
    ['supply_address', 'Dirección suministro'],
    ['contract_number', 'Contrato'],
    ['distributor', 'Distribuidora'],
    ['max_demand_p1_kw', 'Máxima demanda P1'],
    ['max_demand_p2_kw', 'Máxima demanda P2']
  ];

  return (
    <AuthGuard>
      <div className="space-y-6">

        <div>
          <h1 className="text-2xl font-bold">Facturas</h1>
          <p className="text-slate-500 mt-1">
            Sube, revisa y conserva tus facturas originales.
          </p>
        </div>

        <div className="panel p-5 space-y-4">

          <div
            onDragOver={e => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => {
              e.preventDefault();
              setDrag(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => input.current?.click()}
            className={`drop cursor-pointer ${drag ? 'border-blue-500 bg-blue-50' : ''}`}
          >
            <FileUp size={34} className="mx-auto text-blue-600 mb-3" />

            <p className="font-semibold">
              Arrastra tus facturas PDF aquí
            </p>

            <p className="text-sm text-slate-500 mt-1">
              o pulsa para seleccionar uno o varios archivos (máx. 20 MB cada uno)
            </p>

            <input
              ref={input}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={e => addFiles(e.target.files)}
            />
          </div>

          {files.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                {files.length} archivo(s) en cola: {files.map(f => f.name).join(', ')}
              </div>

              <button
                className="btn"
                disabled={busy || !!extracted}
                onClick={analyzeNext}
              >
                Analizar siguiente
              </button>
            </div>
          )}

          {busy && (
            <p className="text-sm text-blue-700 flex items-center gap-2">
              <LoaderCircle className="animate-spin" size={16} />
              {status}
            </p>
          )}

          {status && !busy && (
            <p className="text-sm text-emerald-700 flex gap-2">
              <CheckCircle2 size={16} />
              {status}
            </p>
          )}

          {error && (
            <p className="text-sm text-red-700 flex gap-2">
              <AlertTriangle size={16} />
              {error}
            </p>
          )}

        </div>

        {extracted && (
          <div className="panel p-5 space-y-4">

            <div>
              <h2 className="text-lg font-semibold">
                Revisar datos extraídos
              </h2>

              <p className="text-sm text-slate-500">
                Archivo: {currentFile?.name}. Los campos vacíos no se han podido identificar.
                Comprueba los valores antes de confirmar.
              </p>
            </div>

            <div className="rounded-lg bg-amber-50 text-amber-800 p-3 text-sm">
              Nivel de confianza: {extracted.confidence}. {extracted.review_notes?.join(' · ')}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {fields.map(([key, label]) => (
                <label className="text-sm" key={key}>
                  <span className="block text-slate-500 mb-1">
                    {label}
                  </span>

                  <input
                    className="field"
                    type="text"
                    style={{
                      color: '#111827',
                      backgroundColor: '#ffffff',
                      opacity: 1
                    }}
                    value={String(extracted[key] ?? '')}
                    onChange={e => {
                      const raw = e.target.value;

                      const numeric = [
                        'billing_days',
                        'total_eur',
                        'consumption_kwh',
                        'average_energy_price_eur_kwh',
                        'contracted_power_p1_kw',
                        'contracted_power_p2_kw',
                        'power_amount_eur',
                        'energy_amount_eur',
                        'electricity_tax_eur',
                        'meter_rental_eur',
                        'vat_rate_percent',
                        'vat_amount_eur',
                        'other_charges_eur',
                        'max_demand_p1_kw',
                        'max_demand_p2_kw'
                      ].includes(key);

                      update(
                        key,
                        (raw === '' ? null : numeric ? Number(raw) : raw) as never
                      );
                    }}
                  />
                </label>
              ))}
            </div>

            <div>
              <h3 className="font-semibold mb-2">
                Consumo por periodos
              </h3>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Periodo</th>
                      <th>kWh</th>
                      <th>€/kWh</th>
                      <th>Importe €</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(extracted.periods || []).map((p, i) => (
                      <tr key={i}>
                        <td>{p.period}</td>
                        <td>{p.consumption_kwh ?? '—'}</td>
                        <td>{p.price_eur_kwh ?? '—'}</td>
                        <td>{p.amount_eur ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="btn"
                disabled={busy}
                onClick={save}
              >
                Confirmar y guardar
              </button>

              <button
                className="btn-secondary"
                onClick={() => {
                  setExtracted(null);
                  setCurrentFile(null);
                }}
              >
                Cancelar revisión
              </button>
            </div>

          </div>
        )}

        <div className="panel p-5">
          <h2 className="font-semibold text-lg mb-4">
            Histórico guardado ({saved.length})
          </h2>

          {saved.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aún no hay facturas guardadas.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Compañía</th>
                    <th>Periodo</th>
                    <th>Consumo</th>
                    <th>Importe</th>
                    <th>PDF</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {saved.map(b => (
                    <tr key={b.id}>
                      <td>{b.issue_date || '—'}</td>
                      <td>{b.company || '—'}</td>
                      <td>{b.period_start || '—'} – {b.period_end || '—'}</td>
                      <td>{b.consumption_kwh ?? '—'} kWh</td>
                      <td>
                        {b.total_eur == null ? '—' : `${b.total_eur.toFixed(2)} €`}
                      </td>
                      <td>
                        <button
                          onClick={() => download(b)}
                          className="text-blue-600"
                        >
                          <Download size={17} />
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => remove(b)}
                          className="text-red-500"
                        >
                          <Trash2 size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AuthGuard>
  );
}

export default function Page() {
  return <Invoices />;
}