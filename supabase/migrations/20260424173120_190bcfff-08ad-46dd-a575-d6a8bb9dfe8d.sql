UPDATE public.transactions
SET 
  amount = ROUND((a.consultation_value * COALESCE(a.clinic_percentage, 25) / 100.0)::numeric, 2),
  description = 'Recebimento comissão - ' || p.name
FROM public.appointments a
JOIN public.professionals p ON p.id = a.professional_id
WHERE transactions.appointment_id = a.id
  AND transactions.type = 'entrada'
  AND transactions.description LIKE 'Consulta - %'
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t2 
    WHERE t2.appointment_id = transactions.appointment_id 
    AND t2.type = 'saida'
  );