export const extractionSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    company:{type:['string','null']}, invoice_number:{type:['string','null']}, issue_date:{type:['string','null']}, period_start:{type:['string','null']}, period_end:{type:['string','null']}, billing_days:{type:['number','null']},
    total_eur:{type:['number','null']}, consumption_kwh:{type:['number','null']}, average_energy_price_eur_kwh:{type:['number','null']}, contracted_power_p1_kw:{type:['number','null']}, contracted_power_p2_kw:{type:['number','null']},
    power_amount_eur:{type:['number','null']}, energy_amount_eur:{type:['number','null']}, electricity_tax_eur:{type:['number','null']}, meter_rental_eur:{type:['number','null']}, vat_rate_percent:{type:['number','null']}, vat_amount_eur:{type:['number','null']},
    other_charges_eur:{type:['number','null']}, cups:{type:['string','null']}, supply_address:{type:['string','null']}, contract_number:{type:['string','null']}, distributor:{type:['string','null']}, max_demand_p1_kw:{type:['number','null']}, max_demand_p2_kw:{type:['number','null']},
    periods:{type:'array',items:{type:'object',additionalProperties:false,properties:{period:{type:'string'},consumption_kwh:{type:['number','null']},price_eur_kwh:{type:['number','null']},amount_eur:{type:['number','null']},meter_reading:{type:['number','null']},reading_type:{type:['string','null']}},required:['period','consumption_kwh','price_eur_kwh','amount_eur','meter_reading','reading_type']}},
    other_concepts:{type:'array',items:{type:'object',additionalProperties:false,properties:{name:{type:'string'},amount_eur:{type:['number','null']}},required:['name','amount_eur']}},
    confidence:{type:'string',enum:['high','medium','low']}, review_notes:{type:'array',items:{type:'string'}}, currency:{type:'string',enum:['EUR']}
  },
  required:['company','invoice_number','issue_date','period_start','period_end','billing_days','total_eur','consumption_kwh','average_energy_price_eur_kwh','contracted_power_p1_kw','contracted_power_p2_kw','power_amount_eur','energy_amount_eur','electricity_tax_eur','meter_rental_eur','vat_rate_percent','vat_amount_eur','other_charges_eur','cups','supply_address','contract_number','distributor','max_demand_p1_kw','max_demand_p2_kw','periods','other_concepts','confidence','review_notes','currency']
} as const;
