-- Desacopla "dia real do pagamento" (transaction_date) de "mês que a
-- obrigação de piso cobre" (reference_month). Até agora as duas coisas
-- viviam no mesmo campo transaction_date, o que forçava travar a data
-- real do lançamento pra caber no mês de referência — distorcendo o
-- caixa (o dinheiro aparecia num dia em que não entrou de fato).
--
-- Aditivo e retrocompatível: coluna nova, nullable. Registros existentes
-- ficam com reference_month = NULL e continuam sendo calculados pelo
-- fallback em business-rules.ts (mês do transaction_date, como sempre
-- foi) — nada muda pra trás. Só passa a existir uma forma explícita e
-- correta de registrar isso daqui pra frente.

alter table public.transactions
  add column if not exists reference_month text;

comment on column public.transactions.reference_month is
  'Mês (formato YYYY-MM) que este lançamento de piso quita — desacoplado de transaction_date, que reflete o dia real do caixa. NULL para transações que não são pagamento manual de piso (ex: vinculadas a appointment_id) ou lançadas antes desta coluna existir.';

-- Backfill: preenche reference_month nos "Complemento piso" já
-- existentes, extraindo mês/ano da própria descrição (mesmo padrão
-- usado nas correções manuais anteriores da Gorete/Margarida).
with meses as (
  select * from (values
    ('Janeiro',1),('Fevereiro',2),('Março',3),('Abril',4),
    ('Maio',5),('Junho',6),('Julho',7),('Agosto',8),
    ('Setembro',9),('Outubro',10),('Novembro',11),('Dezembro',12)
  ) as m(nome, numero)
),
alvo as (
  select
    id,
    (regexp_match(description, '- (\S+)/(\d{4})$'))[1] as mes_nome,
    (regexp_match(description, '- (\S+)/(\d{4})$'))[2]::int as ano_ref
  from public.transactions
  where type = 'entrada'
    and appointment_id is null
    and description ilike 'Complemento piso%'
    and reference_month is null
)
update public.transactions t
set reference_month = to_char(make_date(a.ano_ref, m.numero, 1), 'YYYY-MM')
from alvo a
join meses m on m.nome = a.mes_nome
where t.id = a.id;
