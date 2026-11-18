-- Antiabuso do trial: só o worker e as funções de cobrança (oc_admin) leem e gravam.
-- DELETE: o Admin Master pode liberar um bloqueio indevido.
GRANT SELECT, INSERT, DELETE ON trial_usos TO oc_admin;
