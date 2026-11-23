CREATE TABLE "evento_carpas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_updated_at" bigint DEFAULT (extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"evento_id" uuid NOT NULL,
	"carpa_id" uuid,
	"nombre" text,
	"prestada_por" text,
	"capacidad" integer,
	"devuelta" boolean DEFAULT false NOT NULL,
	"tribu" text,
	"cantidad" integer,
	"genero" text,
	"dirigente" text,
	"observaciones" text
);
--> statement-breakpoint
CREATE TABLE "eventos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_updated_at" bigint DEFAULT (extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"nombre" text NOT NULL,
	"fecha_inicio" text,
	"fecha_fin" text,
	"lugar" text,
	"notas" text
);
--> statement-breakpoint
CREATE INDEX "evento_carpas_evento" ON "evento_carpas" USING btree ("evento_id");--> statement-breakpoint
CREATE INDEX "evento_carpas_sync" ON "evento_carpas" USING btree ("server_updated_at");--> statement-breakpoint
CREATE INDEX "eventos_sync" ON "eventos" USING btree ("server_updated_at");