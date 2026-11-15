export type Period = { period: 'punta'|'llano'|'valle'|string; consumption_kwh: number|null; price_eur_kwh: number|null; amount_eur: number|null; meter_reading: number|null; reading_type: string|null };
export type BillExtraction = {
  company: string|null; invoice_number: string|null; issue_date: string|null; period_start: string|null; period_end: string|null; billing_days: number|null;
  total_eur: number|null; consumption_kwh: number|null; average_energy_price_eur_kwh: number|null; contracted_power_p1_kw: number|null; contracted_power_p2_kw: number|null;
  power_amount_eur: number|null; energy_amount_eur: number|null; electricity_tax_eur: number|null; meter_rental_eur: number|null; vat_rate_percent: number|null; vat_amount_eur: number|null;
  other_charges_eur: number|null; cups: string|null; supply_address: string|null; contract_number: string|null; distributor: string|null;
  max_demand_p1_kw: number|null; max_demand_p2_kw: number|null; periods: Period[]; other_concepts: {name:string; amount_eur:number|null}[];
  confidence: 'high'|'medium'|'low'; review_notes: string[]; currency: 'EUR';
};
