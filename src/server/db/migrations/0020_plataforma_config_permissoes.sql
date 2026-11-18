-- Só o portal /admin e o worker leem e gravam os ajustes da plataforma.
GRANT SELECT, INSERT, UPDATE ON plataforma_config TO oc_admin;
