alter table public.transactions
  add column if not exists reference_month text;

comment on column public.transactions.reference_month is
  'Mês (formato YYYY-MM) que este lançamento de piso quita — desacoplado de transaction_date, que reflete o dia real do caixa. NULL para transações que não são pagamento manual de piso (ex: vinculadas a appointment_id) ou lançadas antes desta coluna existir.';

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