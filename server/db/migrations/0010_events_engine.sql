CREATE TABLE "event_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"source_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"big" boolean DEFAULT false NOT NULL,
	"push" text DEFAULT 'digest' NOT NULL,
	"pushed_at" timestamp with time zone,
	"push_result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin" text NOT NULL,
	"source_id" text,
	"url" text,
	"title" text,
	"excerpt" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hash" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"triage" jsonb,
	"event_id" text,
	"message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_spend" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"month" text NOT NULL,
	"day" date NOT NULL,
	"model" text NOT NULL,
	"purpose" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"web_searches" integer DEFAULT 0 NOT NULL,
	"micro_usd" integer DEFAULT 0 NOT NULL,
	"signal_id" uuid,
	"event_id" text,
	"dry_run" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "kind" text DEFAULT 'con' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "fandoms" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "big" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "dossier" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "weather" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "transit" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "image" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "origin" text DEFAULT 'descriptor' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "investigated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "event_log_event_at" ON "event_log" USING btree ("event_id","at");--> statement-breakpoint
CREATE INDEX "event_log_push" ON "event_log" USING btree ("push","pushed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "event_signals_hash" ON "event_signals" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "event_signals_status" ON "event_signals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "event_spend_month" ON "event_spend" USING btree ("month");