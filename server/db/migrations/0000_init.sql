CREATE TABLE "carpas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_updated_at" bigint DEFAULT (extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" text NOT NULL,
	"capacidad" integer,
	"estado_general" text NOT NULL,
	"notas" text,
	"foto_principal_id" uuid
);
--> statement-breakpoint
CREATE TABLE "fotos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_updated_at" bigint DEFAULT (extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"carpa_id" uuid NOT NULL,
	"url" text NOT NULL,
	"thumb_url" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revisiones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_updated_at" bigint DEFAULT (extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"carpa_id" uuid NOT NULL,
	"fecha" text NOT NULL,
	"bolsa_estado" text,
	"bolsa_nota" text,
	"cuerpo_estado" text,
	"cuerpo_nota" text,
	"cierres_estado" text,
	"cierres_nota" text,
	"parantes_estado" text,
	"parantes_nota" text,
	"estacas_cantidad" integer,
	"estacas_estado" text,
	"estacas_nota" text,
	"vientos_estado" text,
	"vientos_nota" text,
	"sobretecho_estado" text,
	"sobretecho_nota" text,
	"cantidad_personas" text,
	"tribu" text,
	"dirigente_tribu" text,
	"dirigente_comision" text,
	"observaciones" text,
	"campa" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "carpas_codigo_vivo" ON "carpas" USING btree ("codigo") WHERE "carpas"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "carpas_sync" ON "carpas" USING btree ("server_updated_at");--> statement-breakpoint
CREATE INDEX "fotos_carpa" ON "fotos" USING btree ("carpa_id");--> statement-breakpoint
CREATE INDEX "fotos_sync" ON "fotos" USING btree ("server_updated_at");--> statement-breakpoint
CREATE INDEX "revisiones_carpa" ON "revisiones" USING btree ("carpa_id","fecha");--> statement-breakpoint
CREATE INDEX "revisiones_sync" ON "revisiones" USING btree ("server_updated_at");