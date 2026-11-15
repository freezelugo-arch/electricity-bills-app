-- Ejecutar en Supabase SQL Editor. Cada fila pertenece al usuario autenticado.
create extension if not exists pgcrypto;
create table if not exists public.invoices (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 company text, invoice_number text, issue_date date, period_start date, period_end date, billing_days integer,
 total_eur numeric(14,4), consumption_kwh numeric(14,4), average_energy_price_eur_kwh numeric(14,8),
 contracted_power_p1_kw numeric(12,4), contracted_power_p2_kw numeric(12,4), power_amount_eur numeric(14,4), energy_amount_eur numeric(14,4),
 electricity_tax_eur numeric(14,4), meter_rental_eur numeric(14,4), vat_rate_percent numeric(7,4), vat_amount_eur numeric(14,4), other_charges_eur numeric(14,4),
 cups text, supply_address text, contract_number text, distributor text, max_demand_p1_kw numeric(12,4), max_demand_p2_kw numeric(12,4),
 periods jsonb not null default '[]'::jsonb, other_concepts jsonb not null default '[]'::jsonb, confidence text, review_notes jsonb not null default '[]'::jsonb,
 storage_path text not null, original_filename text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id, invoice_number)
);
create index if not exists invoices_user_issue_date_idx on public.invoices(user_id, issue_date desc);
alter table public.invoices enable row level security;
create policy "Users can read own invoices" on public.invoices for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own invoices" on public.invoices for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own invoices" on public.invoices for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own invoices" on public.invoices for delete to authenticated using (auth.uid() = user_id);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('electricity-bills','electricity-bills',false,20971520,array['application/pdf'])
on conflict (id) do update set public=false, file_size_limit=20971520, allowed_mime_types=array['application/pdf'];
create policy "Users can upload own bill PDFs" on storage.objects for insert to authenticated with check (bucket_id='electricity-bills' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Users can read own bill PDFs" on storage.objects for select to authenticated using (bucket_id='electricity-bills' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Users can delete own bill PDFs" on storage.objects for delete to authenticated using (bucket_id='electricity-bills' and (storage.foldername(name))[1]=auth.uid()::text);
