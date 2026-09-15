CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"country" text,
	"venue" text,
	"starts_on" date,
	"ends_on" date,
	"tier" text,
	"url" text NOT NULL,
	"source_url" text,
	"confidence" text DEFAULT 'unconfirmed' NOT NULL,
	"date_evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_verified_at" timestamp with time zone,
	"page_hash" text,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hers" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_budgets" (
	"month" text PRIMARY KEY NOT NULL,
	"committed_micros" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"generation" integer NOT NULL,
	"mode" text NOT NULL,
	"taste_revision" text NOT NULL,
	"taste" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state" text DEFAULT 'building' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_controls" (
	"key" text PRIMARY KEY NOT NULL,
	"until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_editions" (
	"build_id" uuid NOT NULL,
	"section" text NOT NULL,
	"day" date NOT NULL,
	"revision" text NOT NULL,
	"taste_revision" text NOT NULL,
	"state" text DEFAULT 'staged' NOT NULL,
	"slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reserve" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feed_editions_build_id_section_pk" PRIMARY KEY("build_id","section")
);
--> statement-breakpoint
CREATE TABLE "feed_identities" (
	"key" text PRIMARY KEY NOT NULL,
	"canonical_id" text NOT NULL,
	"seen_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"hidden_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_items" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"native_id" text NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"media" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"credit" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"identity_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"safety" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"safety_status" text DEFAULT 'pending' NOT NULL,
	"visibility" text DEFAULT 'active' NOT NULL,
	"reason" text,
	"hidden_by" text,
	"score" real,
	"blurb" jsonb,
	"fixture" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "feed_runs" (
	"build_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"day" date NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"attempt" integer DEFAULT 0 NOT NULL,
	"checkpoint" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "feed_runs_build_id_stage_pk" PRIMARY KEY("build_id","stage")
);
--> statement-breakpoint
CREATE TABLE "feed_seen" (
	"item_id" text PRIMARY KEY NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_source_health" (
	"source" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"last_ok_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text,
	"last_count" integer DEFAULT 0 NOT NULL,
	"fail_streak" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_storage" (
	"key" text PRIMARY KEY NOT NULL,
	"reserved_bytes" bigint DEFAULT 0 NOT NULL,
	"copy_bytes" bigint DEFAULT 0 NOT NULL,
	"total_store_bytes" bigint,
	"measured_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "feed_usage" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_key" text NOT NULL,
	"month" text NOT NULL,
	"build_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"purpose" text NOT NULL,
	"model" text NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"reserved_micros" integer NOT NULL,
	"charged_micros" integer NOT NULL,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "feed_usage_request_key_unique" UNIQUE("request_key")
);
--> statement-breakpoint
CREATE TABLE "saves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_id" text NOT NULL,
	"item_id" text,
	"identity_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"credit" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"copy_policy" text DEFAULT 'link_only' NOT NULL,
	"copy_state" text DEFAULT 'link_only' NOT NULL,
	"copy_token" uuid,
	"copy_lease_until" timestamp with time zone,
	"copy_attempts" integer DEFAULT 0 NOT NULL,
	"reserved_bytes" integer DEFAULT 0 NOT NULL,
	"blob_path" text,
	"bytes" integer DEFAULT 0 NOT NULL,
	"content_type" text,
	"copy_error" text,
	"last_checked_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saves_canonical_id_unique" UNIQUE("canonical_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "feed_build_generation" ON "feed_builds" USING btree ("day","generation");--> statement-breakpoint
CREATE INDEX "feed_edition_read" ON "feed_editions" USING btree ("section","state","day");--> statement-breakpoint
CREATE INDEX "feed_identity_canonical" ON "feed_identities" USING btree ("canonical_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feed_item_native" ON "feed_items" USING btree ("source","native_id");--> statement-breakpoint
CREATE INDEX "feed_item_eligibility" ON "feed_items" USING btree ("safety_status","visibility");--> statement-breakpoint
CREATE INDEX "feed_item_expiry" ON "feed_items" USING btree ("expires_at");