CREATE TABLE "trial_usos" (
	"tipo" text NOT NULL,
	"valor_hash" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trial_usos_tipo_valor_hash_pk" PRIMARY KEY("tipo","valor_hash")
);
